import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { appConfig } from '../core/config.js';
import { logger } from '../core/logger.js';

export interface BrowserFingerprint {
  userAgent: string;
  screen: { width: number; height: number; colorDepth: number; pixelDepth: number };
  locale: string;
  timezone: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  languages: string[];
  webgl: {
    vendor: string;
    renderer: string;
  };
  canvas: {
    noise: number; // small noise seed for canvas fingerprint
  };
  audio: {
    noise: number; // small noise seed for audio fingerprint
  };
  fonts: string[];
  connection: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 2560, height: 1440 },
];

const WEBGL_RENDERERS = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
];

const COMMON_FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype',
  'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  'Segoe UI', 'Calibri', 'Cambria', 'Consolas',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function getProxyTimezone(): Promise<string> {
  if (!appConfig.proxy.url) return 'America/New_York';

  try {
    const proxyUrl = new URL(appConfig.proxy.url);
    const ip = proxyUrl.hostname;

    const resp = await fetch(`https://ipinfo.io/${ip}/json`, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();

    if (data.timezone) {
      logger.info(`Proxy timezone detected: ${data.timezone} (${data.city}, ${data.country})`);
      return data.timezone;
    }
  } catch (err) {
    logger.warn(`Failed to detect proxy timezone: ${err}`);
  }

  return 'America/New_York';
}

async function generateFingerprint(): Promise<BrowserFingerprint> {
  const timezone = await getProxyTimezone();
  const ua = pick(USER_AGENTS);
  const screenSize = pick(VIEWPORTS);
  const isMac = ua.includes('Macintosh');

  return {
    userAgent: ua,
    screen: {
      ...screenSize,
      colorDepth: 24,
      pixelDepth: 24,
    },
    locale: 'en-US',
    timezone,
    platform: isMac ? 'MacIntel' : 'Win32',
    hardwareConcurrency: pick([4, 8, 12, 16]),
    deviceMemory: pick([4, 8, 16]),
    maxTouchPoints: 0,
    languages: ['en-US', 'en'],
    webgl: pick(WEBGL_RENDERERS),
    canvas: {
      noise: Math.random() * 0.01, // very small noise
    },
    audio: {
      noise: Math.random() * 0.0001,
    },
    fonts: pickN(COMMON_FONTS, 10, 15),
    connection: {
      effectiveType: pick(['4g', '4g', '4g', '3g']),
      downlink: pick([1.5, 2.5, 5, 10, 20]),
      rtt: pick([50, 100, 150, 200]),
    },
  };
}

export async function loadOrCreateFingerprint(): Promise<BrowserFingerprint> {
  const fpPath = appConfig.fingerprint.path;

  if (existsSync(fpPath)) {
    try {
      const data = JSON.parse(readFileSync(fpPath, 'utf-8'));
      logger.info(`Fingerprint loaded from ${fpPath}`);
      return data;
    } catch {
      logger.warn('Failed to load fingerprint, generating new one');
    }
  }

  const fp = await generateFingerprint();
  const dir = dirname(fpPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fpPath, JSON.stringify(fp, null, 2));
  logger.info(`New fingerprint generated and saved to ${fpPath}`);
  return fp;
}
