import type { Page } from 'playwright';
import { logger } from '../core/logger.js';
import { openNewTab } from '../browser/engine.js';
import { randomDelay } from '../browser/human.js';
import { appConfig } from '../core/config.js';
import { SELECTORS } from './selectors.js';
import type { ClientProfile, ClientJob, FreelancerReview } from '../types/project.js';

function starsWidthToRating(style: string): number {
  const match = style.match(/([\d.]+)%/);
  if (!match) return 0;
  return Math.round((parseFloat(match[1]) / 20) * 10) / 10;
}

export async function fetchClientProfile(profileUrl: string): Promise<ClientProfile | null> {
  const fullUrl = profileUrl.startsWith('http')
    ? profileUrl
    : appConfig.search.baseUrl + profileUrl;

  logger.info(`Fetching client profile: ${fullUrl}`);
  const page = await openNewTab(fullUrl);

  try {
    await randomDelay(1500, 2500);
    await page.evaluate(() => window.scrollTo(0, 500));
    await randomDelay(1500, 2000);

    // ── Basic info ─────────────────────────────────────────────
    const name = await page.locator(SELECTORS.clientProfile.name)
      .first().textContent().catch(() => '') ?? '';

    const ratingStyle = await page.locator(SELECTORS.clientProfile.ratingFill)
      .first().getAttribute('style').catch(() => '') ?? '';
    const rating = starsWidthToRating(ratingStyle);

    const flagClass = await page.locator(SELECTORS.clientProfile.flag)
      .first().getAttribute('class').catch(() => '') ?? '';
    const countryCode = flagClass.match(/flag-(\w+)/)?.[1] ?? '';

    const paymentVerified = await page.locator(SELECTORS.clientProfile.paymentVerified)
      .isVisible().catch(() => false);

    const pubText = await page.locator(SELECTORS.clientProfile.projectsPublished)
      .first().textContent().catch(() => '0') ?? '0';
    const projectsPublished = parseInt(pubText.trim()) || 0;

    const paidText = await page.locator(SELECTORS.clientProfile.projectsPaid)
      .first().textContent().catch(() => '0') ?? '0';
    const projectsPaid = parseInt(paidText.trim()) || 0;

    const lastLogin = await page.locator(SELECTORS.clientProfile.lastLogin)
      .first().getAttribute('title').catch(() => '') ?? '';

    const memberSince = await page.locator(SELECTORS.clientProfile.memberSince)
      .first().getAttribute('title').catch(() => '') ?? '';

    // ── Open jobs ──────────────────────────────────────────────
    const openJobs: ClientJob[] = [];
    const jobItems = page.locator(SELECTORS.clientProfile.openJobItem);
    const jobCount = await jobItems.count();

    for (let i = 0; i < jobCount; i++) {
      try {
        const item = jobItems.nth(i);
        const title = await item.locator(SELECTORS.clientProfile.jobTitle)
          .first().textContent().catch(() => '') ?? '';
        const url = await item.locator(SELECTORS.clientProfile.jobTitle)
          .first().getAttribute('href').catch(() => '') ?? '';
        const publishedAt = await item.locator(SELECTORS.clientProfile.jobDate)
          .first().textContent().catch(() => '') ?? '';
        const budget = await item.locator(SELECTORS.clientProfile.jobBudget)
          .first().textContent().catch(() => '') ?? '';

        const slug = url.replace('/job/', '').replace(/^\//, '');
        openJobs.push({
          slug,
          title: title.trim(),
          url: url.trim(),
          budget: budget.trim(),
          publishedAt: publishedAt.trim(),
        });
      } catch (err) {
        logger.warn(`Failed to parse job item ${i}: ${err}`);
      }
    }

    // ── Freelancer reviews ─────────────────────────────────────
    const reviews: FreelancerReview[] = [];
    const reviewItems = page.locator(SELECTORS.clientProfile.reviewItem);
    const reviewCount = await reviewItems.count();

    for (let i = 0; i < reviewCount; i++) {
      try {
        const item = reviewItems.nth(i);
        const jobTitle = await item.locator(SELECTORS.clientProfile.reviewJobTitle)
          .first().textContent().catch(() => '') ?? '';
        const jobUrl = await item.locator(SELECTORS.clientProfile.reviewJobTitle)
          .first().getAttribute('href').catch(() => '') ?? '';
        const freelancerName = await item.locator(SELECTORS.clientProfile.reviewFreelancerName)
          .first().textContent().catch(() => '') ?? '';
        const freelancerUrl = await item.locator(SELECTORS.clientProfile.reviewFreelancerName)
          .first().getAttribute('href').catch(() => '') ?? '';
        const rStyle = await item.locator(SELECTORS.clientProfile.reviewRatingFill)
          .first().getAttribute('style').catch(() => '') ?? '';
        const reviewRating = starsWidthToRating(rStyle);
        const timeAgo = await item.locator(SELECTORS.clientProfile.reviewDate)
          .first().textContent().catch(() => '') ?? '';
        const comment = await item.locator(SELECTORS.clientProfile.reviewComment)
          .first().textContent().catch(() => '') ?? '';

        reviews.push({
          jobTitle: jobTitle.trim(),
          jobUrl: jobUrl.trim(),
          freelancerName: freelancerName.trim(),
          freelancerUrl: freelancerUrl.trim(),
          rating: reviewRating,
          comment: comment.trim(),
          timeAgo: timeAgo.trim(),
        });
      } catch (err) {
        logger.warn(`Failed to parse review item ${i}: ${err}`);
      }
    }

    logger.info(`  Client: ${name.trim()}, jobs=${openJobs.length}, reviews=${reviews.length}`);

    return {
      profileUrl,
      name: name.trim(),
      countryCode,
      paymentVerified,
      rating,
      projectsPublished,
      projectsPaid,
      memberSince,
      lastLogin,
      openJobs,
      reviews,
    };
  } catch (err) {
    logger.error(`Failed to fetch client profile ${profileUrl}: ${err}`);
    return null;
  } finally {
    await page.close();
    await randomDelay(1000, 2000);
  }
}
