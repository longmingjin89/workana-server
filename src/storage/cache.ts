import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { appConfig } from '../core/config.js';
import { logger } from '../core/logger.js';

// Cache stores only project URLs for duplicate detection
interface CacheData {
  seenUrls: Record<string, string>; // url -> seenAt ISO timestamp
}

class Cache {
  private data: CacheData = { seenUrls: {} };
  private filePath: string;

  constructor() {
    this.filePath = appConfig.paths.cachePath;
    this.load();
  }

  load(): void {
    if (!existsSync(this.filePath)) {
      this.data = { seenUrls: {} };
      return;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
      logger.info(`Cache loaded: ${Object.keys(this.data.seenUrls).length} seen projects`);
    } catch {
      logger.warn('Failed to load cache, starting fresh');
      this.data = { seenUrls: {} };
    }
  }

  save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  hasSeen(url: string): boolean {
    return url in this.data.seenUrls;
  }

  markSeen(url: string): void {
    this.data.seenUrls[url] = new Date().toISOString();
  }

  markSeenBatch(urls: string[]): void {
    const now = new Date().toISOString();
    for (const url of urls) {
      this.data.seenUrls[url] = now;
    }
  }

  get size(): number {
    return Object.keys(this.data.seenUrls).length;
  }

  clear(): void {
    this.data = { seenUrls: {} };
    this.save();
  }

  cleanup(ttlHours: number, maxEntries = 2000): void {
    const cutoff = Date.now() - ttlHours * 60 * 60 * 1000;
    const before = Object.keys(this.data.seenUrls).length;

    // Remove expired entries
    for (const [url, seenAt] of Object.entries(this.data.seenUrls)) {
      if (new Date(seenAt).getTime() < cutoff) {
        delete this.data.seenUrls[url];
      }
    }

    // If still over maxEntries, remove oldest entries first
    const entries = Object.entries(this.data.seenUrls);
    if (entries.length > maxEntries) {
      entries.sort((a, b) => new Date(a[1]).getTime() - new Date(b[1]).getTime());
      const toRemove = entries.length - maxEntries;
      for (let i = 0; i < toRemove; i++) {
        delete this.data.seenUrls[entries[i][0]];
      }
    }

    const after = Object.keys(this.data.seenUrls).length;
    if (before !== after) {
      logger.info(`Cache cleanup: removed ${before - after} entries (${after} remaining)`);
    }
  }
}

export const cache = new Cache();
