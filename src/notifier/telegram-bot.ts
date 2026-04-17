import { logger } from '../core/logger.js';
import { appConfig } from '../core/config.js';

const BASE_URL = 'https://api.telegram.org/bot';

async function callApi(method: string, body: Record<string, any>): Promise<any> {
  const token = appConfig.telegram.botToken;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const resp = await fetch(`${BASE_URL}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }
  return data.result;
}

export async function postMessage(text: string): Promise<number> {
  const result = await callApi('sendMessage', {
    chat_id: appConfig.telegram.channelId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

  logger.info(`Posted to Telegram (msg_id: ${result.message_id})`);
  return result.message_id;
}
