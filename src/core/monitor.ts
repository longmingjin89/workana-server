import { logger } from './logger.js';
import { appConfig } from './config.js';
import { launchBrowser, closeBrowser } from '../browser/engine.js';
import { navigateToDashboard, waitForManualLogin } from '../scraper/auth.js';
import { navigateToJobsPage, applyFilters, collectProjects, refreshListingPage } from '../scraper/listing.js';
import { fetchProjectDetail } from '../scraper/detail.js';
import { formatProjectMessage } from '../notifier/formatter.js';
import { postToChannel, initTelegram, startReplyListener } from '../notifier/telegram.js';
import { cache } from '../storage/cache.js';
import { waitForNextCycle } from './scheduler.js';
import { randomDelay } from '../browser/human.js';
import type { Page } from 'playwright';

let isFirstCycle = true;

function isHourly(budget: string): boolean {
  return /\/\s*hour/i.test(budget);
}

// Extract upper number from "USD 500 - 1,000", "€ 400 - 900", "Over USD 3,000"
function extractUpperNumber(budget: string): number {
  if (!budget) return 0;
  const numbers = budget.replace(/,/g, '').match(/[\d.]+/g);
  if (!numbers || numbers.length === 0) return 0;
  return parseFloat(numbers[numbers.length - 1]);
}

// Parse "27 minutes ago", "1 hour ago", "Yesterday" etc. to minutes
function parsePublishedMinutes(text: string): number {
  const t = text.toLowerCase().trim();
  if (t.includes('just now')) return 0;
  if (t.includes('almost') && t.includes('hour')) return 50;
  if (t.includes('yesterday')) return 24 * 60;

  const numMatch = t.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : 0;

  if (t.includes('minute')) return num;
  if (t.includes('hour')) return num * 60;
  if (t.includes('day')) return num * 24 * 60;
  if (t.includes('week')) return num * 7 * 24 * 60;
  if (t.includes('month')) return num * 30 * 24 * 60;

  return Infinity;
}

function isRecentProject(publishedAt: string): boolean {
  const minutes = parsePublishedMinutes(publishedAt);
  const maxMinutes = appConfig.monitor.intervalMax + 10;
  return minutes <= maxMinutes;
}

function passesBudgetFilter(budget: string): boolean {
  if (isHourly(budget)) return false;

  const maxBudget = appConfig.posting.maxBudget;
  if (maxBudget <= 0) return true;

  const upper = extractUpperNumber(budget);
  if (upper === 0) return true; // Can't parse = include

  return upper >= maxBudget;
}

async function ensureLoggedIn(page: Page): Promise<void> {
  const loggedIn = await navigateToDashboard(page);

  if (!loggedIn) {
    if (appConfig.browser.headless) {
      logger.info('Login required - restarting browser in visible mode...');
      await closeBrowser();
      const result = await launchBrowser(true);
      await waitForManualLogin(result.page);
      await closeBrowser();
      const final = await launchBrowser();
      await navigateToDashboard(final.page);
    } else {
      await waitForManualLogin(page);
    }
  }
}

async function runCycle(page: Page): Promise<void> {
  logger.info('=== Cycle started ===');

  if (isFirstCycle) {
    // First run: login, navigate, apply filters, cache all projects
    await ensureLoggedIn(page);
    await navigateToJobsPage(page);
    const filtersOk = await applyFilters(page);
    if (!filtersOk) {
      logger.warn('Filters failed - restarting browser');
      throw new Error('FILTER_FAILED');
    }

    const projects = await collectProjects(page, true);
    cache.markSeenBatch(projects.map(p => p.url));
    cache.save();
    logger.info(`First run: cached ${projects.length} new project URLs (${cache.size} total)`);
    isFirstCycle = false;
    return;
  }

  // Subsequent runs: refresh and find new projects
  const refreshOk = await refreshListingPage(page);
  if (!refreshOk) {
    logger.warn('Refresh filters failed - restarting browser');
    throw new Error('FILTER_FAILED');
  }

  const newProjects = await collectProjects(page);

  // Cache new URLs immediately
  for (const p of newProjects) {
    cache.markSeen(p.url);
  }
  cache.save();

  if (newProjects.length === 0) {
    logger.info('No new projects found');
    return;
  }

  // Filter: recent projects only + budget threshold
  const filtered = newProjects.filter(p => isRecentProject(p.publishedAt) && passesBudgetFilter(p.budget));

  if (filtered.length === 0) {
    logger.info(`${newProjects.length} new projects found, none passed filters`);
    return;
  }

  logger.info(`${filtered.length} projects to post (${newProjects.length - filtered.length} filtered)`);

  // Post oldest first, newest last
  filtered.reverse();

  for (const summary of filtered) {
    try {
      const detail = await fetchProjectDetail(summary);
      const message = formatProjectMessage(detail);

      await postToChannel(message);

      logger.info(`Posted: ${summary.title.substring(0, 50)}...`);
      await randomDelay(1000, 3000);
    } catch (err) {
      logger.error(`Failed to process ${summary.url}: ${err}`);
    }
  }

  logger.info(`=== Cycle completed: ${filtered.length} posted ===`);
}

export async function startMonitor(once: boolean): Promise<void> {
  cache.clear();
  logger.info('Cache cleared on startup');

  await initTelegram();
  await startReplyListener();

  const forceVisible = false;
  let { page } = await launchBrowser(forceVisible);

  try {
    await runCycle(page);
  } catch (err) {
    logger.error(`Cycle error: ${err}`);
    isFirstCycle = true;
  }

  if (once) {
    logger.info('Single run complete. Exiting.');
    await closeBrowser();
    return;
  }

  while (true) {
    await waitForNextCycle();

    // Check if page/browser is still alive before running cycle
    let pageAlive = false;
    try {
      await page.evaluate(() => document.readyState);
      pageAlive = true;
      logger.info('Page is still alive, proceeding with cycle');
    } catch {
      logger.warn('Page is dead before cycle start, will relaunch browser');
    }

    if (!pageAlive) {
      isFirstCycle = true;
      try {
        await closeBrowser();
        const result = await launchBrowser(false);
        page = result.page;
        logger.info('Browser relaunched successfully');
      } catch (relaunchErr) {
        logger.error(`Browser relaunch failed: ${relaunchErr}`);
        continue;
      }
    }

    try {
      await runCycle(page);
    } catch (err) {
      logger.error(`Cycle error: ${err}`);
      isFirstCycle = true;

      try {
        await closeBrowser();
        const result = await launchBrowser(false);
        page = result.page;
        logger.info('Browser relaunched after cycle error');
      } catch (retryErr) {
        logger.error(`Browser relaunch failed: ${retryErr}`);
      }
    }
  }
}
