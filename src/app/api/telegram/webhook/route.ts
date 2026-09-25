import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { buildBotReply, toSendMessage } from '@/lib/bot-replies';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/** Telegram webhook: same replies as the long-polling bot (src/bot/telegram-bot.mjs). */
export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const msg = update?.message;
    const chatId = msg?.chat?.id;
    if (!chatId) return NextResponse.json({ ok: true });

    const reply = buildBotReply(kapilyaStore.getRawData(), { text: msg.text, location: msg.location });
    await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSendMessage(chatId, reply)),
    }).catch((err) => console.error('Failed to send telegram message:', err));

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
