import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { buildBotReply, toSendMessage } from '@/lib/bot-replies';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
/** Sent by Telegram in X-Telegram-Bot-Api-Secret-Token (set by `npm run bot:webhook`), so only Telegram can post here. */
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Health check for `npm run bot:webhook`: whether this deployment has the bot's settings.
 * Only yes/no, never the values.
 */
export async function GET() {
  return NextResponse.json({ ok: true, configured: Boolean(BOT_TOKEN), secured: Boolean(WEBHOOK_SECRET) });
}

/** Telegram webhook: same replies as the long-polling bot (src/bot/telegram-bot.mjs). */
export async function POST(request: NextRequest) {
  if (!BOT_TOKEN || !WEBHOOK_SECRET || request.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const update = await request.json();
    const msg = update?.message;
    const chatId = msg?.chat?.id;
    if (!chatId) return NextResponse.json({ ok: true });

    const reply = await buildBotReply(kapilyaStore.getRawData(), { text: msg.text, location: msg.location });
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSendMessage(chatId, reply)),
    });
    if (!res.ok) console.error('Telegram sendMessage failed:', res.status, await res.text());
  } catch (err: unknown) {
    console.error('Telegram webhook error:', err);
  }
  // Always 200 once the request is genuine: an error status makes Telegram resend the same message.
  return NextResponse.json({ ok: true });
}
