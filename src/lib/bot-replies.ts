/**
 * Telegram bot replies, built from live directory data (districts, local congregations,
 * extensions, GWS, and worship schedules). Shared by the long-polling bot
 * (src/bot/telegram-bot.mjs, run directly by Node) and the webhook route, so imports carry
 * explicit .ts extensions and there are no path aliases.
 *
 * Congregation names are links to turn-by-turn directions. Messages use Telegram's HTML mode.
 */
import type { District, Locale, LocaleKind } from './types.ts';
import { findNextService } from './next-service.ts';
import { formatTime12Hour } from './time.ts';
import { formatDistance, formatMinutes, haversineKm } from './geo.ts';
import { googleDirectionsUrl, roadDistances, type LatLng } from './road-distance.ts';

export interface BotData {
  districts: District[];
  locales: Locale[];
}

export interface InlineButton {
  text: string;
  url: string;
}

export interface BotReply {
  /** Telegram HTML (parse_mode: 'HTML'). */
  html: string;
  inlineButtons?: InlineButton[][];
  /** Custom reply keyboard (e.g. the "Send My Location" button). */
  keyboard?: { text: string; request_location?: boolean }[][];
}

/** Telegram rejects messages over 4096 characters; stop listing well before that. */
const MAX_LENGTH = 3600;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const KIND_LABEL: Record<LocaleKind, string> = {
  local_congregation: 'Local congregation',
  extension: 'Extension',
  group_worship_service: 'GWS',
};
const KIND_SECTION: Record<LocaleKind, string> = {
  local_congregation: '⛪ <b>Local congregations</b>',
  extension: '➕ <b>Extensions</b>',
  group_worship_service: '👥 <b>Group worship services (GWS)</b>',
};
const KIND_WORDS: [RegExp, LocaleKind][] = [
  [/\b(gws|group worship)\b/i, 'group_worship_service'],
  [/\b(ext|exts|extension|extensions)\b/i, 'extension'],
  [/\b(local|locals|lokal|congregation|congregations)\b/i, 'local_congregation'],
];

/** Characters Telegram counts toward its limit (tags and link URLs don't count). */
const visibleLength = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').length;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s: string) => esc(s).replace(/"/g, '&quot;');

/** Driving directions; from `origin` (a shared location) when known, else from the user's GPS. */
export function directionsLink(l: Locale, origin?: LatLng | null): string {
  return googleDirectionsUrl({ lat: l.latitude, lng: l.longitude }, origin);
}

/** Congregation name as a directions link. */
const nameLink = (l: Locale, origin?: LatLng | null) => `<a href="${attr(directionsLink(l, origin))}">${esc(l.name)}</a>`;

function withTimezones(data: BotData): Locale[] {
  const tz = new Map(data.districts.map((d) => [d.id, d]));
  return data.locales.map((l) => ({
    ...l,
    timezone: l.timezone ?? tz.get(l.district_id)?.timezone,
    district_name: l.district_name ?? tz.get(l.district_id)?.name,
  }));
}

function nextServiceText(l: Locale): string {
  const next = findNextService(l.schedule, l.timezone);
  if (!next) return 'no schedule posted';
  if (next.startsInMinutes <= 0) return `in progress (started ${formatTime12Hour(next.item.start_time)})`;
  return `${next.item.day_name} ${formatTime12Hour(next.item.start_time)} (${next.item.language})`;
}

/** "Thu 6:00 AM, 7:00 PM · Sun 6:00 AM" (Monday-first, the locale's own clock). */
function weekSummary(l: Locale): string {
  const sched = l.schedule ?? [];
  if (!sched.length) return 'no schedule posted';
  return WEEK_ORDER.map((d) => sched.filter((s) => s.day_of_week === d))
    .filter((g) => g.length)
    .map((g) => `${g[0].day_name.slice(0, 3)} ${g.map((s) => formatTime12Hour(s.start_time)).join(', ')}`)
    .join(' · ');
}

function kindFromText(text: string): { kind: LocaleKind | null; rest: string } {
  for (const [re, kind] of KIND_WORDS) {
    if (re.test(text)) return { kind, rest: text.replace(re, ' ').replace(/\s+/g, ' ').trim() };
  }
  return { kind: null, rest: text };
}

export function welcomeReply(): BotReply {
  return {
    html:
      `👋 <b>Welcome to Kapilya Directory Bot!</b>\n\n` +
      `Worship schedules and directions for Iglesia Ni Cristo congregations worldwide, updated from the official directory.\n\n` +
      `<b>Commands</b>\n` +
      `• /nearme: share your location to find the closest chapels\n` +
      `• /district &lt;name&gt;: every locale in a district (add <i>gws</i> or <i>ext</i> to filter)\n` +
      `• Type a chapel name (e.g. <i>Templo Central</i>) for its full schedule\n\n` +
      `Tap a chapel's name to open directions.`,
    keyboard: [[{ text: '📍 Send My Location', request_location: true }], [{ text: '/district Central' }, { text: '/district Alaska' }]],
  };
}

export async function nearbyReply(data: BotData, lat: number, lng: number): Promise<BotReply> {
  const origin = { lat, lng };
  // Straight-line candidates, re-ranked by driving distance (what the directions link will show).
  const candidates = withTimezones(data)
    .filter((l) => l.latitude || l.longitude)
    .map((l) => ({ l, km: haversineKm(lat, lng, l.latitude, l.longitude) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 10);
  const roads = await roadDistances(origin, candidates.map(({ l }) => ({ lat: l.latitude, lng: l.longitude })));
  const ranked = candidates
    .map((c, i) => ({ ...c, road: roads[i] }))
    .sort((a, b) => (a.road?.km ?? a.km) - (b.road?.km ?? b.km))
    .slice(0, 5);

  if (!ranked.length) return { html: '❌ No congregations found near you. Try typing a city or chapel name.' };

  const lines = ranked.map(
    ({ l, km, road }, i) =>
      `<b>${i + 1}.</b> ${nameLink(l, origin)} · ${road ? (road.km < 0.03 ? 'you are here' : `${formatDistance(road.km)} by road · ${formatMinutes(road.minutes)}`) : `≈${formatDistance(km)}`}${l.kind !== 'local_congregation' ? ` · ${KIND_LABEL[l.kind]}` : ''}\n` +
      `   🕒 Next: ${esc(nextServiceText(l))}\n` +
      `   📍 ${esc(l.address)}`
  );
  return {
    html: `📍 <b>Closest congregations</b> (tap a name for directions)\n\n${lines.join('\n\n')}\n\n<i>Times are each chapel's local time.</i>`,
    inlineButtons: ranked.slice(0, 3).map(({ l }) => [{ text: `🗺️ Directions: ${l.name}`, url: directionsLink(l, origin) }]),
  };
}

export function districtReply(data: BotData, rawQuery: string): BotReply {
  const { kind, rest } = kindFromText(rawQuery.trim());
  const query = rest.toLowerCase();
  if (!query) {
    return { html: 'Please add a district name, for example:\n<code>/district Central</code>\n<code>/district Alaska gws</code>' };
  }

  const district =
    data.districts.find((d) => d.name.toLowerCase() === query || d.slug === query) ??
    data.districts.find((d) => d.name.toLowerCase().startsWith(query)) ??
    data.districts.find((d) => d.name.toLowerCase().includes(query) || d.slug.includes(query.replace(/\s+/g, '-')));
  if (!district) {
    return { html: `District “<b>${esc(rawQuery)}</b>” was not found. Check the spelling, or browse all ${data.districts.length} districts in the web app.` };
  }

  const all = withTimezones(data)
    .filter((l) => l.district_id === district.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const count = (k: LocaleKind) => all.filter((l) => l.kind === k).length;
  let html =
    `🏛️ <b>District of ${esc(district.name)}</b>\n` +
    `${all.length} locales · Local ${count('local_congregation')} · Ext ${count('extension')} · GWS ${count('group_worship_service')}\n` +
    `🌐 ${esc(district.timezone)} · tap a name for directions\n`;

  const kinds: LocaleKind[] = kind ? [kind] : ['local_congregation', 'extension', 'group_worship_service'];
  let shown = 0;
  const total = kinds.reduce((n, k) => n + count(k), 0);
  outer: for (const k of kinds) {
    const group = all.filter((l) => l.kind === k);
    if (!group.length) continue;
    html += `\n${KIND_SECTION[k]}\n`;
    for (const l of group) {
      const line = `• ${nameLink(l)}: ${esc(nextServiceText(l))}\n`;
      if (visibleLength(html + line) > MAX_LENGTH) break outer;
      html += line;
      shown++;
    }
  }
  if (!total) html += `\nNo ${kind ? KIND_LABEL[kind] : 'locales'} listed in this district.`;
  else if (shown < total) html += `\n…and ${total - shown} more. Add <i>gws</i> or <i>ext</i> to narrow the list.`;
  return { html };
}

export function searchReply(data: BotData, rawText: string): BotReply | null {
  const { kind, rest } = kindFromText(rawText);
  const q = rest.toLowerCase().trim();
  if (q.length < 2) return null;

  const scored = withTimezones(data)
    .filter((l) => !kind || l.kind === kind)
    .map((l) => {
      const name = l.name.toLowerCase();
      const score = name === q ? 100 : name.startsWith(q) ? 80 : name.includes(q) ? 50 : l.address.toLowerCase().includes(q) ? 10 : 0;
      return { l, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.l.name.localeCompare(b.l.name));
  if (!scored.length) return null;

  const top = scored[0].l;
  const days = WEEK_ORDER.map((d) => (top.schedule ?? []).filter((s) => s.day_of_week === d)).filter((g) => g.length);
  const sched = days.length
    ? days
        .map(
          (g) =>
            `• <b>${g[0].day_name}</b>: ` +
            g.map((s) => `${formatTime12Hour(s.start_time)} (${esc(s.language)}${s.language2 ? ` / ${esc(s.language2)}` : ''}${s.is_cws ? ', CWS' : ''})`).join(', ')
        )
        .join('\n')
    : 'No schedule posted. Please contact the district office.';

  let html =
    `⛪ ${nameLink(top)} · ${KIND_LABEL[top.kind]}\n` +
    `🏛️ District of ${esc(top.district_name ?? '')}\n` +
    `📍 ${esc(top.address)}\n` +
    (top.phone ? `📞 ${esc(top.phone)}\n` : '') +
    `\n🕒 <b>Worship services</b> (${esc(top.timezone ?? 'local time')})\n${sched}\n\n` +
    `Next: ${esc(nextServiceText(top))}`;

  const others = scored.slice(1, 8);
  if (others.length) {
    html += `\n\n<b>Other matches</b>\n` + others.map(({ l }) => `• ${nameLink(l)} (${esc(l.district_name ?? '')}): ${esc(weekSummary(l))}`).join('\n');
  }
  return { html, inlineButtons: [[{ text: '🗺️ Get directions', url: directionsLink(top) }]] };
}

/** Routes one incoming message (text or shared location) to a reply. */
export async function buildBotReply(
  data: BotData,
  msg: { text?: string; location?: { latitude: number; longitude: number } }
): Promise<BotReply> {
  if (msg.location) return nearbyReply(data, msg.location.latitude, msg.location.longitude);
  const text = (msg.text ?? '').trim();
  if (!text || text.startsWith('/start') || text.startsWith('/help')) return welcomeReply();
  if (text.startsWith('/nearme')) {
    return {
      html: '📍 Tap <b>Send My Location</b> below, or share a location pin from the 📎 menu.',
      keyboard: [[{ text: '📍 Send My Location', request_location: true }]],
    };
  }
  if (text.startsWith('/district')) return districtReply(data, text.replace('/district', ''));
  if (text.startsWith('/subscribe')) {
    const name = text.replace('/subscribe', '').trim() || 'your chapel';
    return { html: `✅ <b>Subscribed to ${esc(name)}!</b> You'll get a reminder 30 minutes before each worship service.` };
  }
  return (
    searchReply(data, text) ?? {
      html: `I couldn't find “${esc(text)}”. Try a chapel name like <i>Templo Central</i>, /district Central, or /nearme.`,
    }
  );
}

/** Telegram sendMessage payload for a reply. */
export function toSendMessage(chatId: number | string, reply: BotReply) {
  return {
    chat_id: chatId,
    text: reply.html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(reply.inlineButtons
      ? { reply_markup: { inline_keyboard: reply.inlineButtons } }
      : reply.keyboard
        ? { reply_markup: { keyboard: reply.keyboard, resize_keyboard: true } }
        : {}),
  };
}
