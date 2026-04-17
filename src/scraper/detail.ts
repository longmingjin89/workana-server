import type { Page } from 'playwright';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import { logger } from '../core/logger.js';
import { openNewTab } from '../browser/engine.js';
import { randomDelay } from '../browser/human.js';
import { appConfig } from '../core/config.js';
import { SELECTORS } from './selectors.js';
import type { ProjectSummary, ProjectDetail, ClientReview } from '../types/project.js';

countries.registerLocale(enLocale);

function countryCodeToName(code: string): string {
  if (!code) return '';
  const name = countries.getName(code.toUpperCase(), 'en');
  return name || code.toUpperCase();
}

function starsWidthToRating(style: string): number {
  const match = style.match(/([\d.]+)%/);
  if (!match) return 0;
  return Math.round((parseFloat(match[1]) / 20) * 10) / 10;
}

async function extractClientReviews(page: Page): Promise<ClientReview[]> {
  const reviews: ClientReview[] = [];

  const reviewSection = page.locator(SELECTORS.detail.reviewSection);
  if (!(await reviewSection.isVisible().catch(() => false))) {
    return reviews;
  }

  const reviewItems = page.locator(SELECTORS.detail.reviewList);
  const count = await reviewItems.count();

  for (let i = 0; i < count; i++) {
    try {
      const item = reviewItems.nth(i);

      const projectTitle = await item.locator(SELECTORS.detail.reviewProjectTitle)
        .first().textContent().catch(() => '') || '';

      const freelancerName = await item.locator(SELECTORS.detail.reviewFreelancerName)
        .first().textContent().catch(() => '') || '';

      const freelancerLink = await item.locator(SELECTORS.detail.reviewFreelancerLink)
        .first().getAttribute('href').catch(() => '') || '';

      const ratingStyle = await item.locator(SELECTORS.detail.reviewRating)
        .first().getAttribute('style').catch(() => '') || '';
      const rating = starsWidthToRating(ratingStyle);

      const timeAgo = await item.locator(SELECTORS.detail.reviewTime)
        .first().textContent().catch(() => '') || '';

      // Review text: p tag after wk-user-info (if present)
      const allPs = item.locator('> p');
      const pCount = await allPs.count();
      let comment: string | null = null;
      if (pCount > 1) {
        const lastP = await allPs.nth(pCount - 1).textContent().catch(() => null);
        if (lastP && lastP.trim() !== '.' && lastP.trim().length > 1) {
          comment = lastP.trim();
        }
      }

      reviews.push({
        projectTitle: projectTitle.trim(),
        freelancerName: freelancerName.trim(),
        freelancerProfileUrl: freelancerLink.trim(),
        rating,
        timeAgo: timeAgo.trim(),
        comment,
      });
    } catch (err) {
      logger.warn(`Failed to parse review ${i}: ${err}`);
    }
  }

  return reviews;
}

export async function fetchProjectDetail(summary: ProjectSummary): Promise<ProjectDetail> {
  const fullUrl = appConfig.search.baseUrl + summary.url;
  logger.info(`Fetching detail: ${summary.title.substring(0, 50)}...`);

  const page = await openNewTab(fullUrl);

  try {
    await randomDelay(1000, 2000);

    // Title
    const title = await page.locator(SELECTORS.detail.title)
      .first().textContent().catch(() => summary.title) || summary.title;

    // Status
    const status = await page.locator(SELECTORS.detail.status)
      .first().textContent().catch(() => 'open') || 'open';

    // Budget
    const budget = await page.locator(SELECTORS.detail.budget)
      .first().textContent().catch(() => summary.budget) || summary.budget;

    // Description
    let fullDescription = await page.locator(SELECTORS.detail.description)
      .first().textContent().catch(() => '') || '';
    if (!fullDescription) {
      fullDescription = await page.locator(SELECTORS.detail.specification)
        .first().textContent().catch(() => summary.descriptionPreview) || summary.descriptionPreview;
    }

    // Category / subcategory
    const specBolds = page.locator('.specification b');
    const specCount = await specBolds.count();
    const category = specCount > 0 ? (await specBolds.nth(0).textContent() || '') : '';
    const subcategory = specCount > 1 ? (await specBolds.nth(1).textContent() || '') : '';

    // Skills
    const skillEls = page.locator(SELECTORS.detail.skills);
    const skillCount = await skillEls.count();
    const skills: string[] = [];
    for (let s = 0; s < skillCount; s++) {
      const t = await skillEls.nth(s).textContent();
      if (t) skills.push(t.trim());
    }

    // Client info
    const clientName = await page.locator(SELECTORS.detail.clientName)
      .first().textContent().catch(() => summary.clientName) || summary.clientName;

    const clientProfileUrl = await page.locator(SELECTORS.detail.clientProfileLink)
      .first().getAttribute('href').catch(() => '') || '';

    const clientFlagClass = await page.locator(SELECTORS.detail.clientFlag)
      .first().getAttribute('class').catch(() => '') || '';
    const countryMatch = clientFlagClass.match(/flag-(\w+)/);
    const clientCountry = countryMatch ? countryCodeToName(countryMatch[1]) : summary.clientCountry;

    const clientRatingStyle = await page.locator(SELECTORS.detail.clientRating)
      .first().getAttribute('style').catch(() => '') || '';
    const clientRating = starsWidthToRating(clientRatingStyle);

    // Published/paid count, member since
    const dataItems = page.locator('.item-data');
    const dataCount = await dataItems.count();
    let clientProjectsPublished = 0;
    let clientProjectsPaid = 0;
    let clientMemberSince = '';
    let interestedCount = 0;

    for (let d = 0; d < dataCount; d++) {
      const text = await dataItems.nth(d).textContent() || '';
      if (text.includes('Published projects')) {
        const m = text.match(/(\d+)/);
        if (m) clientProjectsPublished = parseInt(m[1], 10);
      } else if (text.includes('Projects paid')) {
        const m = text.match(/(\d+)/);
        if (m) clientProjectsPaid = parseInt(m[1], 10);
      } else if (text.includes('Member since')) {
        clientMemberSince = text.replace('Member since:', '').trim();
      } else if (text.includes('Interested')) {
        const m = text.match(/(\d+)/);
        if (m) interestedCount = parseInt(m[1], 10);
      }
    }

    // Reviews
    const clientReviews = await extractClientReviews(page);
    if (clientReviews.length > 0) {
      logger.info(`  Found ${clientReviews.length} client reviews`);
    }

    return {
      ...summary,
      title: title.trim(),
      budget: budget.trim(),
      skills: skills.length > 0 ? skills : summary.skills,
      fullDescription: fullDescription.trim(),
      category: category.trim(),
      subcategory: subcategory.trim(),
      status: status.trim(),
      clientName: clientName.trim(),
      clientProfileUrl: clientProfileUrl.trim(),
      clientCountry,
      clientRating,
      clientProjectsPublished,
      clientProjectsPaid,
      clientMemberSince,
      clientReviews,
      interestedCount,
    };
  } finally {
    await page.close();
    await randomDelay(1000, 3000);
  }
}
