import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { appConfig } from '../core/config.js';
import { logger } from '../core/logger.js';
import { applyStealthPatches, getStealthLaunchArgs } from './stealth.js';
import { loadOrCreateFingerprint, type BrowserFingerprint } from './fingerprint.js';

chromium.use(StealthPlugin());

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let mainPage: Page | null = null;
let fingerprint: BrowserFingerprint | null = null;

const COOKIE_FILE = './data/cookie.json';

function readCookiesFromFile(path: string): any[] {
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const cookies = Array.isArray(raw) ? raw : (Array.isArray(raw?.cookies) ? raw.cookies : []);
    return cookies.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expires ?? c.expirationDate ?? -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? false,
      sameSite: ({ 'lax': 'Lax', 'strict': 'Strict', 'none': 'None', 'no_restriction': 'None' } as any)[(c.sameSite || '').toLowerCase()] || 'Lax',
    })).filter((c: any) => c.name && c.value && c.domain);
  } catch {
    return [];
  }
}

export async function launchBrowser(forceVisible = false, noViewport = false): Promise<{ context: BrowserContext; page: Page }> {
  const headless = forceVisible ? false : appConfig.browser.headless;
  fingerprint = await loadOrCreateFingerprint();

  mkdirSync('./data', { recursive: true });

  const launchOptions: any = {
    headless,
    args: [
      ...getStealthLaunchArgs(),
      '--disable-quic',
    ],
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  };

  if (appConfig.proxy.url) {
    const proxyUrl = new URL(appConfig.proxy.url);
    launchOptions.proxy = {
      server: `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,
      username: proxyUrl.username ? decodeURIComponent(proxyUrl.username) : undefined,
      password: proxyUrl.password ? decodeURIComponent(proxyUrl.password) : undefined,
    };
    logger.info(`Using proxy: ${proxyUrl.hostname}:${proxyUrl.port}`);
  }

  logger.info(`Launching browser (headless: ${headless})`);
  browser = await chromium.launch(launchOptions);

  context = await browser.newContext({
    viewport: noViewport ? null : { width: 1920, height: 1080 },
    screen: fingerprint.screen,
    userAgent: fingerprint.userAgent,
    locale: fingerprint.locale,
    timezoneId: fingerprint.timezone,
    extraHTTPHeaders: {
      'Accept-Language': fingerprint.languages.join(',') + ';q=0.9',
    },
  });

  // Restore cookies
  const cookies = readCookiesFromFile(COOKIE_FILE);
  if (cookies.length > 0) {
    await context.addCookies(cookies);
    logger.info(`Session restored (${cookies.length} cookies)`);
  }

  mainPage = await context.newPage();
  await applyStealthPatches(mainPage, fingerprint);

  return { context, page: mainPage };
}

export async function openNewTab(url: string): Promise<Page> {
  if (!context || !fingerprint) throw new Error('Browser not launched');

  const page = await context.newPage();
  await applyStealthPatches(page, fingerprint);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page;
}

export function getMainPage(): Page {
  if (!mainPage) throw new Error('Browser not launched');
  return mainPage;
}

export function getContext(): BrowserContext {
  if (!context) throw new Error('Browser not launched');
  return context;
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    try { await context.close(); } catch { /* already closed */ }
    context = null;
    mainPage = null;
  }
  if (browser) {
    try { await browser.close(); } catch { /* already closed */ }
    browser = null;
  }
  logger.info('Browser closed');
}
