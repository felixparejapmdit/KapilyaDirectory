/**
 * Parser for locale pages on the official INC directory
 * (https://directory.iglesianicristo.net/locales/<slug>).
 *
 * Kept free of runtime imports so it can be shared by the Next.js ingestion
 * route and the standalone `scripts/sync-schedules.ts` crawler.
 */
import type { WorshipScheduleItem } from './types';

export const SOURCE_BASE_URL = 'https://directory.iglesianicristo.net';

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ParsedServiceChip {
  day_name: string;
  day_of_week: number;
  raw_time: string;
  start_time: string | null; // 24h "HH:MM", null if the raw time could not be parsed
  language: string | null; // subchip1, e.g. "Tagalog"
  language2: string | null; // subchip2, e.g. "Tagalog Sign"
  type_label: string | null; // "type" subchip, e.g. "CWS"
}

export interface ParsedLocalePage {
  name: string | null;
  district_slug: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  has_schedule_card: boolean;
  services: ParsedServiceChip[];
  warnings: string[];
}

// Combining marks for accented-letter entities such as &auml; or &ntilde;.
const ENTITY_MARKS: Record<string, string> = {
  acute: '́',
  grave: '̀',
  circ: '̂',
  uml: '̈',
  tilde: '̃',
  ring: '̊',
  cedil: '̧',
};

// Other named entities seen in the source (amp/lt/gt/quot/nbsp are handled below).
const NAMED_ENTITIES: Record<string, string> = {
  szlig: 'ß',
  oslash: 'ø',
  Oslash: 'Ø',
  aelig: 'æ',
  AElig: 'Æ',
  oelig: 'œ',
  OElig: 'Œ',
  eth: 'ð',
  thorn: 'þ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  minus: '−',
  hellip: '…',
  middot: '·',
  deg: '°',
};

// Misspellings and spelling variants that appear in the source's language labels.
const LANGUAGE_FIXES: Record<string, string> = {
  Taglaog: 'Tagalog',
  Tagaolog: 'Tagalog',
  Ilokano: 'Ilocano',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&([a-zA-Z])(acute|grave|circ|uml|tilde|ring|cedil);/g, (_, ch, mark) =>
      (ch + ENTITY_MARKS[mark]).normalize('NFC')
    )
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function cleanText(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** "TAGALOG SIGN" -> "Tagalog Sign"; short all-caps tokens like "ASL" stay upper-case. */
export function titleCaseLabel(label: string): string {
  return label
    .split(/(\s+|-|\/)/)
    .map((tok) => {
      if (!/[A-Za-z]/.test(tok)) return tok;
      if (tok.length <= 3 && tok === tok.toUpperCase()) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    })
    .join('');
}

function normalizeLanguage(label: string): string {
  const titled = titleCaseLabel(label);
  return titled
    .split(' ')
    .map((word) => LANGUAGE_FIXES[word] ?? word)
    .join(' ');
}

/** Converts source times such as "7:00pm", "10:00am", "12:00nn" or "7pm" to 24h "HH:MM". */
export function parseSourceTime(raw: string): string | null {
  const m = raw
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|nn|noon|mn)?$/);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const mins = m[2] ?? '00';
  const suffix = m[3];
  if (hours > 23 || parseInt(mins, 10) > 59) return null;
  if (suffix === 'pm' && hours < 12) hours += 12;
  if (suffix === 'am' && hours === 12) hours = 0;
  if (suffix === 'mn' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${mins}`;
}

export function parseLocalePage(html: string): ParsedLocalePage {
  const warnings: string[] = [];

  const nameMatch = html.match(/<h2>([\s\S]*?)<\/h2>/);
  const districtMatch = html.match(/\/districts\/([a-z0-9-]+)"/i);

  const addressMatch = html.match(/<address>([\s\S]*?)<\/address>/);
  const address = addressMatch
    ? cleanText(addressMatch[1].replace(/<br\s*\/?>/gi, ', ')).replace(/\s*,\s*(,\s*)*/g, ', ').replace(/^,\s*|,\s*$/g, '')
    : null;

  let latitude: number | null = null;
  let longitude: number | null = null;
  const latLngMatch = html.match(/myLatLng\s*=\s*\{\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)\s*\}/);
  const bingMatch = html.match(/bingmaps:\?cp=(-?[\d.]+)~(-?[\d.]+)/);
  const coords = latLngMatch ?? bingMatch;
  if (coords) {
    latitude = parseFloat(coords[1]);
    longitude = parseFloat(coords[2]);
  }

  const phoneMatch = html.match(/>phone<\/i>\s*([^<]+)<br>/);
  const emailMatch = html.match(/>email<\/i>\s*([^<]+)<br>/);

  // Isolate the "Worship Service Schedule" card so chips elsewhere on the page can't leak in.
  const cardStart = html.indexOf('Worship Service Schedule</h2>');
  const services: ParsedServiceChip[] = [];
  if (cardStart !== -1) {
    const afterCard = html.slice(cardStart);
    const cardEnd = afterCard.search(/<div class="mdl-cell mdl-cell--4-col">/);
    const card = cardEnd === -1 ? afterCard : afterCard.slice(0, cardEnd);

    for (const group of card.split('<div class="daygroup">').slice(1)) {
      const dayMatch = group.match(/<h6>([\s\S]*?)<\/h6>/);
      if (!dayMatch) {
        warnings.push('daygroup without <h6> day heading');
        continue;
      }
      const dayName = cleanText(dayMatch[1]);
      const dayOfWeek = DAY_MAP[dayName.toLowerCase()];
      if (dayOfWeek === undefined) {
        warnings.push(`unknown day "${dayName}"`);
        continue;
      }
      const normalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();

      for (const chip of group.split('<div class="chip">').slice(1)) {
        const firstDiv = chip.indexOf('<div');
        const rawTime = cleanText(firstDiv === -1 ? chip : chip.slice(0, firstDiv));

        let language: string | null = null;
        let language2: string | null = null;
        let typeLabel: string | null = null;
        const subchipRe = /<div class="subchip ([^"]*)">([\s\S]*?)<\/div>/g;
        let sub: RegExpExecArray | null;
        while ((sub = subchipRe.exec(chip)) !== null) {
          const classes = sub[1].split(/\s+/);
          const label = cleanText(sub[2]).replace(/[\s,;.]+$/, '');
          if (!label) continue;
          if (classes.includes('subchip1')) language = normalizeLanguage(label);
          else if (classes.includes('subchip2')) language2 = normalizeLanguage(label);
          else if (classes.includes('type')) typeLabel = label.toUpperCase();
          else warnings.push(`unknown subchip class "${sub[1]}" (${label})`);
        }

        const startTime = parseSourceTime(rawTime);
        if (!startTime) warnings.push(`unparseable time "${rawTime}" on ${normalizedDay}`);

        services.push({
          day_name: normalizedDay,
          day_of_week: dayOfWeek,
          raw_time: rawTime,
          start_time: startTime,
          language,
          language2,
          type_label: typeLabel,
        });
      }
    }
  }

  return {
    name: nameMatch ? cleanText(nameMatch[1]) : null,
    district_slug: districtMatch ? districtMatch[1] : null,
    address,
    latitude,
    longitude,
    phone: phoneMatch ? cleanText(phoneMatch[1]) : null,
    email: emailMatch ? cleanText(emailMatch[1]) : null,
    has_schedule_card: cardStart !== -1,
    services,
    warnings,
  };
}

/** Builds app schedule items from a parsed page, preserving the source's day/time order. */
export function buildSchedule(slug: string, parsed: ParsedLocalePage): WorshipScheduleItem[] {
  const localeId = `loc-${slug}`;
  const seen = new Map<string, number>();
  const items: WorshipScheduleItem[] = [];

  for (const svc of parsed.services) {
    if (!svc.start_time) continue;
    const baseId = `sch-${slug}-${svc.day_of_week}-${svc.start_time.replace(':', '')}`;
    const n = (seen.get(baseId) ?? 0) + 1;
    seen.set(baseId, n);
    const isCws = svc.type_label === 'CWS';

    items.push({
      id: n === 1 ? baseId : `${baseId}-${n}`,
      locale_id: localeId,
      service_type: svc.type_label ?? 'Worship',
      day_of_week: svc.day_of_week,
      day_name: svc.day_name,
      start_time: svc.start_time,
      language: svc.language ?? 'Unspecified',
      ...(svc.language2 ? { language2: svc.language2 } : {}),
      is_cws: isCws,
    });
  }

  return items;
}

/** Distinct service languages (primary and secondary) in schedule order. */
export function scheduleLanguages(schedule: WorshipScheduleItem[]): string[] {
  const set = new Set<string>();
  for (const s of schedule) {
    if (s.language && s.language !== 'Unspecified') set.add(s.language);
    if (s.language2) set.add(s.language2);
  }
  return Array.from(set);
}
