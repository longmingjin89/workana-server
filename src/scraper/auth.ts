import type { Page } from 'playwright';
import { logger } from '../core/logger.js';
import { appConfig } from '../core/config.js';
import { randomDelay } from '../browser/human.js';

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      return typeof (window as any).Workana !== 'undefined'
        && typeof (window as any).Workana.userId === 'number';
    });
  } catch {
    return false;
  }
}

export async function navigateToDashboard(page: Page): Promise<boolean> {
  logger.info('Navigating to workana.com/dashboard...');
  await page.goto(appConfig.search.baseUrl + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await randomDelay(2000, 4000);

  const url = page.url();

  if (url.includes('/dashboard') && await isLoggedIn(page)) {
    logger.info('Login confirmed - on dashboard');
    return true;
  }

  logger.warn('Not logged in (url: ' + url + ')');
  return false;
}

export async function waitForManualLogin(page: Page): Promise<void> {
  logger.info('============================================');
  logger.info('  Please log in to Workana in the browser');
  logger.info('  Waiting for login to complete...');
  logger.info('============================================');

  while (true) {
    await new Promise(r => setTimeout(r, 3000));

    try {
      const url = page.url();
      if (url.includes('/dashboard') && await isLoggedIn(page)) {
        logger.info('Login detected!');
        return;
      }
    } catch {
      // page may be navigating
    }
  }
}
