import type { Page } from 'playwright';
import { logger } from '../core/logger.js';
import { appConfig } from '../core/config.js';
import { SELECTORS } from './selectors.js';
import { humanClick, randomDelay } from '../browser/human.js';
import type { ProjectSummary } from '../types/project.js';

// Wait for AJAX response with timeout
async function waitForJobsResponse(page: Page, timeoutMs = 15000): Promise<boolean> {
  try {
    await page.waitForResponse(
      resp => resp.url().includes('/jobs') && resp.request().headers()['x-requested-with'] === 'XMLHttpRequest',
      { timeout: timeoutMs }
    );
    await randomDelay(1000, 2000);
    return true;
  } catch {
    return false;
  }
}

export async function navigateToJobsPage(page: Page): Promise<void> {
  logger.info('Clicking "Find projects"...');

  await page.goto('https://www.workana.com/jobs', { waitUntil: 'domcontentloaded' });

  await page.waitForLoadState('domcontentloaded');
  try {
    await page.waitForSelector('#category-it-programming', { timeout: 15000 });
  } catch {
    await randomDelay(3000, 5000);
  }
  await randomDelay(2000, 4000);
  logger.info('Jobs page loaded');
}

// Click filter and verify it's actually checked
async function clickAndVerifyFilter(page: Page, label: string, input: string, name: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const isChecked = await page.locator(input).isChecked().catch(() => false);

    if (isChecked) {
      logger.info(`${name}: confirmed checked`);
      return true;
    }

    logger.info(`${name}: clicking... (attempt ${attempt + 1})`);
    await page.locator(label).click();
    await waitForJobsResponse(page);

    // Verify after click
    const verified = await page.locator(input).isChecked().catch(() => false);
    if (verified) {
      logger.info(`${name}: confirmed checked after click`);
      return true;
    }

    await randomDelay(1000, 2000);
  }

  logger.warn(`${name}: failed to apply after 3 attempts`);
  return false;
}

// Apply filters and return true only if successful
export async function applyFilters(page: Page): Promise<boolean> {
  const categoryId = appConfig.search.category;
  const languageCode = appConfig.search.language;

  // Category
  if (categoryId) {
    const catOk = await clickAndVerifyFilter(
      page,
      `label[for="category-${categoryId}"]`,
      `#category-${categoryId}`,
      `Category ${categoryId}`
    );
    if (!catOk) return false;
  }

  // Language
  const langMap: Record<string, string> = { 'xx': '0', 'en': '1', 'pt': '2', 'es': '3' };
  const langNum = langMap[languageCode] || '0';
  const langOk = await clickAndVerifyFilter(
    page,
    `label[for="language-${langNum}"]`,
    `#language-${langNum}`,
    `Language ${languageCode}`
  );
  if (!langOk) return false;

  logger.info('Filters verified and applied');
  return true;
}

export async function refreshListingPage(page: Page): Promise<boolean> {
  logger.info('Refreshing listing...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#category-it-programming', { timeout: 15000 });
  } catch {
    await randomDelay(3000, 5000);
  }
  await randomDelay(2000, 4000);
  return await applyFilters(page);
}

export async function scrapeCurrentPage(page: Page): Promise<ProjectSummary[]> {
  const projects: ProjectSummary[] = [];

  const cards = page.locator(SELECTORS.listing.projectCard);
  const count = await cards.count();

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);

    try {
      const isFeatured = (await card.getAttribute('class') || '').includes('project-item-featured');

      const titleEl = card.locator(SELECTORS.listing.title).first();
      const title = await titleEl.getAttribute('title') || await titleEl.textContent() || '';

      const linkEl = card.locator(SELECTORS.listing.titleLink).first();
      const href = await linkEl.getAttribute('href') || '';
      const url = href.split('?')[0];
      const slug = url.split('/job/')[1] || '';

      const dateText = await card.locator(SELECTORS.listing.date).first().textContent().catch(() => '') || '';
      const bidsText = await card.locator(SELECTORS.listing.bids).first().textContent().catch(() => '') || '';
      const bidsMatch = bidsText.match(/\d+/);
      const bidsCount = bidsMatch ? parseInt(bidsMatch[0], 10) : 0;

      const descEl = card.locator(SELECTORS.listing.description).first();
      const descriptionPreview = (await descEl.textContent().catch(() => '') || '').trim();

      const skillEls = card.locator(SELECTORS.listing.skills);
      const skillCount = await skillEls.count();
      const skills: string[] = [];
      for (let s = 0; s < skillCount; s++) {
        const skillText = await skillEls.nth(s).textContent();
        if (skillText) skills.push(skillText.trim());
      }

      const budgetText = await card.locator(SELECTORS.listing.budget).first().textContent().catch(() => '') || '';

      const clientName = await card.locator(SELECTORS.listing.clientName).first().textContent().catch(() => '') || '';
      const clientCountry = await card.locator(SELECTORS.listing.clientCountry).first().textContent().catch(() => '') || '';

      const paymentVerified = await card.locator(SELECTORS.listing.paymentVerified).first().isVisible().catch(() => false);

      projects.push({
        url: url.trim(),
        slug: slug.trim(),
        title: title.trim(),
        budget: budgetText.trim(),
        bidsCount,
        interestedCount: 0,
        publishedAt: dateText.replace('Published:', '').trim(),
        descriptionPreview,
        skills,
        clientName: clientName.trim(),
        clientCountry: clientCountry.trim(),
        clientProfileUrl: '',
        paymentVerified,
        isFeatured,
      });
    } catch (err) {
      logger.warn(`Failed to parse project card ${i}: ${err}`);
    }
  }

  return projects;
}

export async function collectProjects(page: Page, scanAll = false): Promise<ProjectSummary[]> {
  const all: ProjectSummary[] = [];
  const seenInCycle = new Set<string>();
  let pageNum = 1;
  const maxPages = appConfig.posting.maxPagesPerCycle;

  while (pageNum <= maxPages) {
    logger.info(`Scraping page ${pageNum}...`);
    const projects = await scrapeCurrentPage(page);
    logger.info(`Found ${projects.length} projects on page ${pageNum}`);

    let newOnThisPage = 0;

    for (const project of projects) {
      if (project.isFeatured) continue;
      if (seenInCycle.has(project.url)) continue;
      seenInCycle.add(project.url);

      all.push(project);
      newOnThisPage++;
    }

    logger.info(`Page ${pageNum}: ${newOnThisPage} new projects`);

    if (!scanAll && newOnThisPage === 0 && pageNum >= 2) break;

    pageNum++;
    if (pageNum > maxPages) break;

    const nextPageLink = page.locator(`ul.pagination li a:has-text("${pageNum}")`);
    if (!(await nextPageLink.isVisible().catch(() => false))) {
      logger.info('No more pages');
      break;
    }

    await randomDelay(3000, 6000);
    await humanClick(page, `ul.pagination li a:has-text("${pageNum}")`);
    await waitForJobsResponse(page);
  }

  logger.info(`Total projects collected: ${all.length}`);
  return all;
}
