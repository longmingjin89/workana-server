export interface AppConfig {
  telegram: {
    mode: 'bot' | 'account';
    channelId: string;
    botToken?: string;
    apiId?: number;
    apiHash?: string;
    phone?: string;
    sessionPath: string;
  };
  monitor: {
    intervalMin: number;
    intervalMax: number;
    nightPause: boolean;
    nightStart: number;
    nightEnd: number;
  };
  search: {
    baseUrl: string;
    category: string;
    language: string;
  };
  browser: {
    headless: boolean;
  };
  proxy: {
    url: string;
  };
  fingerprint: {
    path: string;
  };
  paths: {
    logPath: string;
    cachePath: string;
  };
  posting: {
    fetchDetail: boolean;
    timezone: string;
    maxBudget: number;
    minHourlyRate: number;
    maxPagesPerCycle: number;
    cacheTtlHours: number;
  };
}
