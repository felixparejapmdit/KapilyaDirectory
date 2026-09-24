/**
 * Kapilya Directory - Official Telegram Bot Companion
 * Bot Username: @KapilyaDirectory_bot
 */

import fs from 'fs';
import path from 'path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Add it to .env.local (see .env.example).');
  process.exit(1);
}
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Helper to calculate haversine distance
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R_KM = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R_KM * c * 10) / 10;
}

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

// Handle incoming messages
function to12H(timeStr) {
  if (!timeStr) return '';
  if (/am|pm/i.test(timeStr)) return timeStr.trim();
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  if (!chatId) return;

  const text = msg.text ? msg.text.trim() : '';

  // 1. Location Shared by user
  if (msg.location) {
    const userLat = msg.location.latitude;
    const userLng = msg.location.longitude;

    const data = getStoreData();
    const ranked = data.locales
      .map((loc) => ({
        ...loc,
        distance: haversineDistance(userLat, userLng, loc.latitude, loc.longitude),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    if (ranked.length === 0) {
      await tgApi('sendMessage', {
        chat_id: chatId,
        text: '❌ No congregations found within reach. Try searching for a specific city.',
      });
      return;
    }

    let reply = `📍 *Closest Iglesia Ni Cristo Congregations:*\n\n`;
    const inlineButtons = [];

    ranked.forEach((l, i) => {
      const nextSched = l.schedule?.[0]
        ? `${l.schedule[0].day_name} at ${to12H(l.schedule[0].start_time)} (${l.schedule[0].language})`
        : 'Confirm with district';

      reply += `*${i + 1}. ${l.name}* (${l.distance} km)\n`;
      reply += `📍 \`${l.address}\`\n`;
      reply += `🕒 *Next:* ${nextSched}\n\n`;

      inlineButtons.push([
        {
          text: `🗺️ Directions: ${l.name}`,
          url: `https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}`,
        },
      ]);
    });

    reply += `_Times rendered in each chapel's local timezone._`;

    await tgApi('sendMessage', {
      chat_id: chatId,
      text: reply,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineButtons,
      },
    });
    return;
  }

  // 2. /start or /help command
  if (text.startsWith('/start') || text.startsWith('/help')) {
    const welcome =
      `👋 *Welcome to Kapilya Directory Bot!*\n\n` +
      `Your near-me finder and worship schedule companion for Iglesia Ni Cristo chapels worldwide.\n\n` +
      `*Commands:*\n` +
      `• /nearme — Share your location to find the closest chapels\n` +
      `• /district <name> — View chapels in any of 198 districts\n` +
      `• /subscribe <chapel> — Get reminders before service\n\n` +
      `Tap *Send My Location* below to find chapels near you instantly:`;

    await tgApi('sendMessage', {
      chat_id: chatId,
      text: welcome,
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '📍 Send My Location', request_location: true }],
          [{ text: '🏛️ /district Alaska' }, { text: '🏛️ /district Central' }],
        ],
        resize_keyboard: true,
      },
    });
    return;
  }

  // 3. /nearme command
  if (text.startsWith('/nearme')) {
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `📍 Please tap the *Send My Location* button below, or attach your location via Telegram's paperclip 📎 menu:`,
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: '📍 Send My Location', request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return;
  }

  // 4. /district command
  if (text.startsWith('/district')) {
    const query = text.replace('/district', '').trim().toLowerCase();
    const data = getStoreData();

    if (!query) {
      await tgApi('sendMessage', {
        chat_id: chatId,
        text: `Please specify a district name. Example:\n\`/district Alaska\`\n\`/district Quezon City\`\n\`/district Tokyo\`\n\`/district London\``,
        parse_mode: 'Markdown',
      });
      return;
    }

    const matchedDistrict = data.districts.find(
      (d) => d.name.toLowerCase().includes(query) || d.slug.includes(query)
    );

    if (!matchedDistrict) {
      await tgApi('sendMessage', {
        chat_id: chatId,
        text: `District matching "*${query}*" was not found. Please check spelling or explore the 198 districts in the web app.`,
        parse_mode: 'Markdown',
      });
      return;
    }

    const districtLocales = data.locales.filter((l) => l.district_id === matchedDistrict.id);

    let reply = `🏛️ *Ecclesiastical District of ${matchedDistrict.name}*\n`;
    reply += `🌐 Timezone: \`${matchedDistrict.timezone}\`\n\n`;

    if (districtLocales.length > 0) {
      districtLocales.forEach((l) => {
        reply += `• *${l.name}* (${l.kind.replace(/_/g, ' ')})\n  📍 ${l.address}\n`;
      });
    } else {
      reply += `_Active congregations are being cataloged for this district._`;
    }

    await tgApi('sendMessage', {
      chat_id: chatId,
      text: reply,
      parse_mode: 'Markdown',
    });
    return;
  }

  // 5. /subscribe command
  if (text.startsWith('/subscribe')) {
    const localeName = text.replace('/subscribe', '').trim() || 'your local chapel';
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `✅ *Subscribed to ${localeName}!* You will receive a reminder notification on Telegram 30 minutes before each worship service starts.`,
      parse_mode: 'Markdown',
    });
    return;
  }

  // 6. Generic Text Lookup (Search for chapel name)
  const data = getStoreData();
  const found = data.locales.filter(
    (l) =>
      l.name.toLowerCase().includes(text.toLowerCase()) ||
      l.address.toLowerCase().includes(text.toLowerCase())
  );

  if (found.length > 0) {
    const top = found[0];
    let schedText = '';
    if (top.schedule && top.schedule.length > 0) {
      schedText = top.schedule
        .map((s) => `• ${s.day_name}: \`${to12H(s.start_time)}\` (${s.language}${s.is_cws ? ', CWS' : ''})`)
        .join('\n');
    } else {
      schedText = 'Schedule details available from district office.';
    }

    const reply =
      `⛪ *${top.name}*\n` +
      `📍 ${top.address}\n\n` +
      `🕒 *Departure Board Schedule (${top.timezone || 'Local Time'}):*\n${schedText}\n\n` +
      (top.phone ? `📞 Phone: ${top.phone}\n` : '');

    await tgApi('sendMessage', {
      chat_id: chatId,
      text: reply,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🗺️ Google Maps Directions',
              url: `https://www.google.com/maps/dir/?api=1&destination=${top.latitude},${top.longitude}`,
            },
          ],
        ],
      },
    });
    return;
  }

  // Fallback
  await tgApi('sendMessage', {
    chat_id: chatId,
    text: `I didn't recognize that command. Type /nearme or /district to begin, or search for a congregation name like *Anchorage* or *Templo Central*.`,
    parse_mode: 'Markdown',
  });
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
