import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';
import { logger } from '../core/logger.js';
import { appConfig } from '../core/config.js';

let client: TelegramClient | null = null;

function getSessionPath(): string {
  return resolve(appConfig.telegram.sessionPath, 'session.txt');
}

function loadSession(): string {
  const path = getSessionPath();
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8').trim();
  }
  return '';
}

function saveSessionString(session: string): void {
  const dir = appConfig.telegram.sessionPath;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getSessionPath(), session);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function initAccountClient(): Promise<void> {
  const apiId = appConfig.telegram.apiId;
  const apiHash = appConfig.telegram.apiHash;
  if (!apiId || !apiHash) throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH required for account mode');

  const sessionStr = loadSession();
  const session = new StringSession(sessionStr);

  client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  if (!sessionStr) {
    logger.info('First-time Telegram account login...');
    await client.start({
      phoneNumber: async () => appConfig.telegram.phone || await prompt('Phone number: '),
      phoneCode: async () => await prompt('Verification code: '),
      password: async () => await prompt('2FA password (if any): '),
      onError: async (err) => { logger.error(`Telegram login error: ${err}`); return true; },
    });

    const newSession = client.session.save() as unknown as string;
    saveSessionString(newSession);
    logger.info('Telegram session saved');
  } else {
    await client.connect();
    logger.info('Telegram account connected (restored session)');
  }
}

export async function postMessage(text: string): Promise<number> {
  if (!client) throw new Error('Telegram account client not initialized');

  const channelId = appConfig.telegram.channelId;
  const result = await client.sendMessage(channelId, { message: text, parseMode: 'html', linkPreview: false });
  const msgId = result.id;

  logger.info(`Posted to Telegram (msg_id: ${msgId})`);
  return msgId;
}

export async function startReplyPolling(
  onReply: (msgId: number, fromId: number, fromName: string, text: string) => void
): Promise<void> {
  if (!client) throw new Error('Telegram account client not initialized');

  const channelId = appConfig.telegram.channelId;

  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg?.replyTo) return;

    const replyToMsgId = msg.replyTo.replyToMsgId;
    if (!replyToMsgId) return;

    const senderId = msg.senderId?.valueOf() || 0;
    let senderName = 'Unknown';

    try {
      const sender = await msg.getSender();
      if (sender && 'firstName' in sender) {
        senderName = (sender as any).firstName || (sender as any).username || 'Unknown';
      }
    } catch { /* ignore */ }

    onReply(replyToMsgId, Number(senderId), senderName, msg.text || '');
  }, new NewMessage({ chats: [channelId] }));

  logger.info('Reply listener started (Account mode, channel: ' + channelId + ')');
}
