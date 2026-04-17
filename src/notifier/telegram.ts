import { appConfig } from '../core/config.js';
import { logger } from '../core/logger.js';
import * as botApi from './telegram-bot.js';
import * as accountApi from './telegram-account.js';

export async function initTelegram(): Promise<void> {
  if (appConfig.telegram.mode === 'account') {
    await accountApi.initAccountClient();
  }

  logger.info(`Telegram initialized (mode: ${appConfig.telegram.mode})`);
}

export async function postToChannel(text: string): Promise<number> {
  if (appConfig.telegram.mode === 'account') {
    return accountApi.postMessage(text);
  }
  return botApi.postMessage(text);
}

export async function startReplyListener(): Promise<void> {
  if (appConfig.telegram.mode !== 'account') {
    logger.info('Reply listening requires account mode - skipped');
    return;
  }

  accountApi.startReplyPolling((msgId, fromId, fromName, text) => {
    logger.info(`Reply from ${fromName} (${fromId}) on msg ${msgId}: ${text}`);
  });
}
