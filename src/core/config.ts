import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { AppConfig } from '../types/config.js';

loadEnv();

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v === 'true' || v === '1';
}

const defaultConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), 'config/default.json'), 'utf-8')
);

export const appConfig: AppConfig = {
  telegram: {
    mode: (env('TELEGRAM_MODE', 'bot') as 'bot' | 'account'),
    channelId: env('TELEGRAM_CHANNEL_ID'),
    botToken: env('TELEGRAM_BOT_TOKEN') || undefined,
    apiId: process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID, 10) : undefined,
    apiHash: env('TELEGRAM_API_HASH') || undefined,
    phone: env('TELEGRAM_PHONE') || undefined,
    sessionPath: env('TELEGRAM_SESSION_PATH', './data/telegram-session'),
  },
  monitor: {
    intervalMin: envInt('MONITOR_INTERVAL_MIN', 2),
    intervalMax: envInt('MONITOR_INTERVAL_MAX', 5),
    nightPause: envBool('MONITOR_NIGHT_PAUSE', false),
    nightStart: envInt('MONITOR_NIGHT_START', 0),
    nightEnd: envInt('MONITOR_NIGHT_END', 7),
  },
  search: {
    baseUrl: defaultConfig.search.baseUrl,
    category: env('SEARCH_CATEGORY', 'it-programming'),
    language: env('SEARCH_LANGUAGE', 'xx'),
  },
  browser: {
    headless: envBool('BROWSER_HEADLESS', false),
  },
  proxy: {
    url: env('PROXY_URL'),
  },
  fingerprint: {
    path: env('FINGERPRINT_PATH', './data/fingerprint.json'),
  },
  paths: {
    logPath: env('LOG_PATH', './logs'),
    cachePath: env('CACHE_PATH', './data/cache.json'),
  },
  posting: {
    fetchDetail: envBool('FETCH_DETAIL', true),
    timezone: env('TIMEZONE', 'UTC'),
    maxBudget: envInt('MAX_BUDGET', 0),
    minHourlyRate: envInt('MIN_HOURLY_RATE', 0),
    maxPagesPerCycle: Math.max(1, envInt('MAX_PAGES_PER_CYCLE', 10)),
    cacheTtlHours: envInt('CACHE_TTL_HOURS', 48),
  },
};
