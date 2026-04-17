import { launchBrowser, closeBrowser } from '../browser/engine.js';
import { logger } from '../core/logger.js';
import '../core/config.js';

async function main() {
  logger.info('Opening Workana with proxy and fingerprint...');

  const { page } = await launchBrowser(true, true);

  let exiting = false;

  async function exit() {
    if (exiting) return;
    exiting = true;
    await closeBrowser();
    logger.info('Browser closed.');
    process.exit(0);
  }

  try {
    await page.goto('https://www.workana.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    logger.error(`Navigation failed: ${err}`);
    await exit();
    return;
  }

  logger.info('Workana opened. Close the browser window to exit.');

  page.on('close', () => exit());
  process.once('SIGINT', () => exit());
  process.once('SIGTERM', () => exit());

  await new Promise<void>(() => {});
}

main().catch((err) => {
  logger.error('Error:', err);
  process.exit(1);
});
