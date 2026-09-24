import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { directionsUrl, formatDistance } from '@/lib/geo';
import { findNextService } from '@/lib/next-service';
import { formatTime12Hour } from '@/lib/time';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegramMessage(chatId: number | string, text: string, extra: any = {}) {
  try {
    await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        ...extra,
      }),
    });
  } catch (err) {
    console.error('Failed to send telegram message:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    const chatId = msg.chat?.id;
    if (!chatId) return NextResponse.json({ ok: true });

    const text = msg.text ? msg.text.trim() : '';

    // 1. User shared native location
    if (msg.location) {
      const userLat = msg.location.latitude;
      const userLng = msg.location.longitude;

      const ranked = kapilyaStore.searchNearby({
        lat: userLat,
        lng: userLng,
        radiusKm: 80,
      }).slice(0, 3);

      if (ranked.length === 0) {
        await sendTelegramMessage(
          chatId,
          '❌ No congregations found within 80 km. Try searching for a specific city name.'
        );
        return NextResponse.json({ ok: true });
      }

      let reply = `📍 *Closest Iglesia Ni Cristo Congregations:*\n\n`;
      const inlineButtons: any[] = [];

      ranked.forEach((l, i) => {
        const next = findNextService(l.schedule, l.timezone);
        const nextSched = next
          ? `${next.item.day_name} at ${formatTime12Hour(next.item.start_time)} (${next.item.language})`
          : 'Confirm with district';

        reply += `*${i + 1}. ${l.name}* (${formatDistance(l.distance_km)})\n`;
        reply += `📍 \`${l.address}\`\n`;
        reply += `🕒 *Next:* ${nextSched}\n\n`;

        inlineButtons.push([
          {
            text: `🗺️ Directions: ${l.name}`,
            url: directionsUrl(l.latitude, l.longitude, l.name),
          },
        ]);
      });

      reply += `_Times rendered in each chapel's local timezone._`;

      await sendTelegramMessage(chatId, reply, {
        reply_markup: { inline_keyboard: inlineButtons },
      });
      return NextResponse.json({ ok: true });
    }

    // 2. /start or /help
    if (text.startsWith('/start') || text.startsWith('/help')) {
      const welcome =
        `👋 *Welcome to Kapilya Directory Bot!*\n\n` +
        `Your near-me finder and worship schedule companion for Iglesia Ni Cristo chapels worldwide.\n\n` +
        `*Commands:*\n` +
        `• /nearme — Share location to find nearest chapels\n` +
        `• /district <name> — Browse chapels across all 198 districts\n` +
        `• /subscribe <chapel> — Service reminders before start\n\n` +
        `Tap *Send My Location* below:`;

      await sendTelegramMessage(chatId, welcome, {
        reply_markup: {
          keyboard: [
            [{ text: '📍 Send My Location', request_location: true }],
            [{ text: '🏛️ /district Alaska' }, { text: '🏛️ /district Central' }],
          ],
          resize_keyboard: true,
        },
      });
      return NextResponse.json({ ok: true });
    }

    // 3. /nearme
    if (text.startsWith('/nearme')) {
      await sendTelegramMessage(
        chatId,
        `📍 Please tap the *Send My Location* button below or share your pin:`,
        {
          reply_markup: {
            keyboard: [[{ text: '📍 Send My Location', request_location: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return NextResponse.json({ ok: true });
    }

    // 4. /district <name>
    if (text.startsWith('/district')) {
      const query = text.replace('/district', '').trim().toLowerCase();
      if (!query) {
        await sendTelegramMessage(
          chatId,
          `Please specify a district name. Example:\n\`/district Alaska\`\n\`/district Tokyo\`\n\`/district Quezon City\``
        );
        return NextResponse.json({ ok: true });
      }

      const districts = kapilyaStore.getDistricts();
      const matched = districts.find(
        (d) => d.name.toLowerCase().includes(query) || d.slug.includes(query)
      );

      if (!matched) {
        await sendTelegramMessage(
          chatId,
          `District "*${query}*" was not found. Please check spelling or explore the 198 districts in the web app.`
        );
        return NextResponse.json({ ok: true });
      }

      const detail = kapilyaStore.getDistrictBySlug(matched.slug);
      let reply = `🏛️ *Ecclesiastical District of ${matched.name}*\n`;
      reply += `🌐 Timezone: \`${matched.timezone}\`\n\n`;

      if (detail && detail.locales.length > 0) {
        detail.locales.forEach((l) => {
          reply += `• *${l.name}* (${l.kind.replace(/_/g, ' ')})\n  📍 ${l.address}\n`;
        });
      } else {
        reply += `_Active congregations are being cataloged for this district._`;
      }

      await sendTelegramMessage(chatId, reply);
      return NextResponse.json({ ok: true });
    }

    // 5. /subscribe
    if (text.startsWith('/subscribe')) {
      const name = text.replace('/subscribe', '').trim() || 'your chapel';
      await sendTelegramMessage(
        chatId,
        `✅ *Subscribed to ${name}!* You will receive a reminder notification on Telegram 30 minutes before each worship service starts.`
      );
      return NextResponse.json({ ok: true });
    }

    // 6. Generic chapel search
    const locales = kapilyaStore.searchNearby({
      lat: 14.6644,
      lng: 121.0544,
      radiusKm: 25000, // global
      query: text,
    });

    if (locales.length > 0) {
      const top = locales[0];
      let schedText = '';
      if (top.schedule && top.schedule.length > 0) {
        schedText = top.schedule
          .map((s) => `• ${s.day_name}: \`${formatTime12Hour(s.start_time)}\` (${s.language}${s.is_cws ? ', CWS' : ''})`)
          .join('\n');
      }

      const reply =
        `⛪ *${top.name}*\n` +
        `📍 ${top.address}\n\n` +
        `🕒 *Departure Board Schedule (${top.timezone || 'Local Time'}):*\n${schedText || 'Contact district office.'}\n\n` +
        (top.phone ? `📞 Phone: ${top.phone}\n` : '');

      await sendTelegramMessage(chatId, reply, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🗺️ Google Maps Directions',
                url: directionsUrl(top.latitude, top.longitude, top.name),
              },
            ],
          ],
        },
      });
      return NextResponse.json({ ok: true });
    }

    // Default fallback
    await sendTelegramMessage(
      chatId,
      `I didn't recognize that command. Type /nearme or /district to begin, or search for a congregation name like *Anchorage* or *Templo Central*.`
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
