import { appConfig } from './config.js';
import { logger } from './logger.js';

function triangularRandom(min: number, max: number): number {
  const u = (Math.random() + Math.random()) / 2;
  return min + u * (max - min);
}

function isNightTime(): boolean {
  if (!appConfig.monitor.nightPause) return false;

  const hour = new Date().getHours();
  const start = appConfig.monitor.nightStart;
  const end = appConfig.monitor.nightEnd;

  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

export async function waitForNextCycle(): Promise<void> {
  if (isNightTime()) {
    const wakeHour = appConfig.monitor.nightEnd;
    const now = new Date();
    const wake = new Date(now);
    wake.setHours(wakeHour, 0, 0, 0);
    if (wake <= now) wake.setDate(wake.getDate() + 1);

    const waitMs = wake.getTime() - now.getTime();
    logger.info(`Night mode: sleeping until ${wake.toLocaleTimeString()} (${Math.round(waitMs / 60000)} min)`);
    await new Promise(r => setTimeout(r, waitMs));
    return;
  }

  const minMs = appConfig.monitor.intervalMin * 60 * 1000;
  const maxMs = appConfig.monitor.intervalMax * 60 * 1000;
  const waitMs = triangularRandom(minMs, maxMs);
  const waitMin = (waitMs / 60000).toFixed(1);

  logger.info(`Next cycle in ${waitMin} minutes`);
  await new Promise(r => setTimeout(r, waitMs));
}
