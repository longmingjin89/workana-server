import { launchBrowser, closeBrowser } from '../browser/engine.js';
import { logger } from '../core/logger.js';
import '../core/config.js';

const TEST_PROFILE_URL = 'https://www.workana.com/e/d99599574bb02250434c2f714cff60ea';

function starsWidthToRating(style: string): number {
  const match = style.match(/([\d.]+)%/);
  if (!match) return 0;
  return Math.round((parseFloat(match[1]) / 20) * 10) / 10;
}

async function main() {
  logger.info('Testing client profile scraping...');
  const { page } = await launchBrowser(false);

  try {
    await page.goto(TEST_PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(2000);

    // ── Client basic info ──────────────────────────────────────
    logger.info('=== Client Info ===');

    const name = await page.locator('.profile-component.profile-employer .h1 span').first().textContent().catch(() => '');
    logger.info(`name: "${name?.trim()}"`);

    const ratingStyle = await page.locator('.profile-component.profile-employer .stars-fill').first().getAttribute('style').catch(() => '');
    const rating = starsWidthToRating(ratingStyle || '');
    logger.info(`rating: ${rating}`);

    const flagClass = await page.locator('.profile-component.profile-employer .flag').first().getAttribute('class').catch(() => '');
    const countryCode = flagClass?.match(/flag-(\w+)/)?.[1] ?? '';
    logger.info(`country code: ${countryCode}`);

    const paymentVerified = await page.locator('.profile-component.profile-employer .payment').isVisible().catch(() => false);
    logger.info(`paymentVerified: ${paymentVerified}`);

    const pubText = await page.locator('.profile-component.profile-employer .rating p:first-child strong').textContent().catch(() => '0');
    const projectsPublished = parseInt(pubText?.trim() || '0');
    logger.info(`projectsPublished: ${projectsPublished}`);

    const paidText = await page.locator('.profile-component.profile-employer .rating p:last-child strong').textContent().catch(() => '0');
    const projectsPaid = parseInt(paidText?.trim() || '0');
    logger.info(`projectsPaid: ${projectsPaid}`);

    const lastLoginEl = await page.locator('.profile-component.profile-employer .activity p:first-child strong').getAttribute('title').catch(() => '');
    logger.info(`lastLogin: "${lastLoginEl}"`);

    const memberSinceEl = await page.locator('.profile-component.profile-employer .activity p:last-child strong').getAttribute('title').catch(() => '');
    logger.info(`memberSince: "${memberSinceEl}"`);

    // ── Freelancer Reviews ─────────────────────────────────────
    logger.info('\n=== Freelancer Reviews ===');
    const reviewItems = page.locator('#ratings-table .js-rating-item');
    const reviewCount = await reviewItems.count();
    logger.info(`review count: ${reviewCount}`);

    for (let i = 0; i < reviewCount; i++) {
      const item = reviewItems.nth(i);
      const jobTitle = await item.locator('h4.title a').first().textContent().catch(() => '');
      const jobUrl = await item.locator('h4.title a').first().getAttribute('href').catch(() => '');
      const freelancerName = await item.locator('.client-name a').first().textContent().catch(() => '');
      const freelancerUrl = await item.locator('.client-name a').first().getAttribute('href').catch(() => '');
      const rStyle = await item.locator('.stars-fill').first().getAttribute('style').catch(() => '');
      const itemRating = starsWidthToRating(rStyle || '');
      const timeAgo = await item.locator('.small.date').first().textContent().catch(() => '');
      const comment = await item.locator('.rating-cite').first().textContent().catch(() => '');
      logger.info(`  [${i}]`);
      logger.info(`    job: "${jobTitle?.trim()}" → ${jobUrl}`);
      logger.info(`    freelancer: "${freelancerName?.trim()}" → ${freelancerUrl}`);
      logger.info(`    rating: ${itemRating}  time: "${timeAgo?.trim()}"`);
      logger.info(`    comment: "${comment?.trim()}"`);
    }

    // ── Open Projects ──────────────────────────────────────────
    logger.info('\n=== Open Projects ===');
    const projectItems = page.locator('#section-open-projects .project-item');
    const projectCount = await projectItems.count();
    logger.info(`project count: ${projectCount}`);

    for (let i = 0; i < projectCount; i++) {
      const item = projectItems.nth(i);
      const title = await item.locator('.project-title a').first().textContent().catch(() => '');
      const url = await item.locator('.project-title a').first().getAttribute('href').catch(() => '');
      const published = await item.locator('.date').first().textContent().catch(() => '');
      const budget = await item.locator('.budget .values span').first().textContent().catch(() => '');
      logger.info(`  [${i}] "${title?.trim()}" | ${url} | ${published?.trim()} | ${budget?.trim()}`);
    }

    logger.info('\n=== SUMMARY ===');
    logger.info(JSON.stringify({
      name: name?.trim(),
      rating,
      countryCode,
      paymentVerified,
      projectsPublished,
      projectsPaid,
      lastLogin: lastLoginEl,
      memberSince: memberSinceEl,
      reviewCount,
      openProjectCount: projectCount,
    }, null, 2));

  } catch (err) {
    logger.error(`Error: ${err}`);
  } finally {
    await closeBrowser();
    logger.info('Done.');
  }
}

main().catch(err => {
  logger.error('Fatal:', err);
  process.exit(1);
});
