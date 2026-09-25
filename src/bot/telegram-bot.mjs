/**
 * Kapilya Directory - Official Telegram Bot Companion
 * Bot Username: @KapilyaDirectory_bot
 */

import fs from 'fs';
import path from 'path';
import { buildBotReply, toSendMessage } from '../lib/bot-replies.ts';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Add it to .env.local (see .env.example).');
  process.exit(1);
}
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Load store data
function getStoreData() {
  const storePath = path.join(process.cwd(), 'data', 'store.json');
  if (fs.existsSync(storePath)) {
    try {
      return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    } catch (e) {
      console.error('Error reading store.json in bot:', e);
    }
  }
  return { locales: [], districts: [], regions: [] };
}

async function tgApi(method, body) {
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API error on ${method}:`, err);
    return null;
  }
}

// Setup bot menu commands
async function setupBotCommands() {
  await tgApi('setMyCommands', {
    commands: [
      { command: 'nearme', description: 'Find nearest chapel by GPS' },
      { command: 'district', description: 'Browse congregations in a district' },
      { command: 'subscribe', description: 'Subscribe to worship service reminders' },
      { command: 'help', description: 'Bot command guide and instructions' },
    ],
  });
  console.log('Bot commands registered with Telegram.');
}

// Handle incoming messages: replies are built from the live store (re-read every message, so
// syncs show up immediately) by the shared module that the webhook route also uses.
async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  if (!chatId) return;
  const reply = await buildBotReply(getStoreData(), { text: msg.text, location: msg.location });
  const res = await tgApi('sendMessage', toSendMessage(chatId, reply));
  if (res && !res.ok) console.error('sendMessage failed:', res.description);
}

// Long-polling loop
let offset = 0;
async function pollUpdates() {
  try {
    const res = await tgApi('getUpdates', {
      offset,
      timeout: 25,
      allowed_updates: ['message', 'callback_query'],
    });

    if (res && res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err);
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Continue polling
  setImmediate(pollUpdates);
}

console.log('Starting Kapilya Directory Telegram Bot (@KapilyaDirectory_bot)...');
setupBotCommands().then(() => {
  pollUpdates();
});
