import { config as loadEnv } from 'dotenv';
loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const BASE_URL = `https://api.telegram.org/bot${token}`;

async function callApi(method: string, body: Record<string, any> = {}): Promise<any> {
  const resp = await fetch(`${BASE_URL}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

async function sendMessage(chatId: number | string, text: string): Promise<void> {
  await callApi('sendMessage', { chat_id: chatId, text }).catch(() => {});
}

function formatInfo(chat: any): string {
  const lines = [
    `Type: ${chat.type}`,
    `Chat ID: ${chat.id}`,
  ];

  if (chat.title) lines.push(`Title: ${chat.title}`);
  if (chat.username) lines.push(`Username: @${chat.username}`);

  lines.push('');

  if (chat.type === 'channel') {
    lines.push(`TELEGRAM_CHANNEL_ID=${chat.id}`);
  } else if (chat.type === 'group' || chat.type === 'supergroup') {
    lines.push(`Group ID: ${chat.id}`);
  }

  return lines.join('\n');
}

function isInfoCommand(text: string | undefined): boolean {
  if (!text) return false;
  return text.trim() === '/info' || text.trim().startsWith('/info@');
}

async function main() {
  const me = await callApi('getMe');
  if (!me.ok) {
    console.error('Failed to connect:', me);
    process.exit(1);
  }

  console.log(`Bot: @${me.result.username} (ID: ${me.result.id})`);
  console.log('Waiting... Send /info anywhere.');
  console.log('');
  console.log('NOTE: If bot does not respond in groups, disable Privacy Mode:');
  console.log('  @BotFather -> /mybots -> select bot -> Bot Settings -> Group Privacy -> Turn off');
  console.log('');

  let offset = 0;

  while (true) {
    try {
      const updates = await callApi('getUpdates', {
        offset,
        timeout: 30,
      });

      if (!updates.ok) continue;

      for (const update of updates.result) {
        offset = update.update_id + 1;

        // Debug: log raw update type
        const types = Object.keys(update).filter(k => k !== 'update_id');
        console.log(`Update: ${types.join(', ')}`);

        // Bot added to channel/group
        if (update.my_chat_member) {
          const chat = update.my_chat_member.chat;
          const info = formatInfo(chat);
          console.log(info);
          await sendMessage(chat.id, info);
        }

        // Message (DM, group, or group comment on channel post)
        if (update.message && isInfoCommand(update.message.text)) {
          const chat = update.message.chat;
          const info = formatInfo(chat);
          console.log(info);
          await sendMessage(chat.id, info);
        }

        // Channel post
        if (update.channel_post && isInfoCommand(update.channel_post.text)) {
          const chat = update.channel_post.chat;
          const info = formatInfo(chat);
          console.log(info);
          await sendMessage(chat.id, info);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

main();
