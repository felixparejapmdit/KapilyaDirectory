import type { LocaleKind } from '../types';

export type VoiceIntentType =
  | 'FIND_NEAREST'
  | 'GET_DIRECTIONS'
  | 'CHECK_SCHEDULE'
  | 'FILTER_REGION'
  | 'FILTER_DISTRICT'
  | 'FILTER_KIND'
  | 'STOP'
  | 'ASK';

export interface VoiceIntent {
  type: VoiceIntentType;
  kind: { kind: LocaleKind; label: string } | null;
  region?: string;
  district?: { name: string; slug: string };
}

export interface VoiceVocabulary {
  regions: string[];
  districts: { name: string; slug: string }[];
}

const KINDS: { kind: LocaleKind; label: string; pattern: RegExp }[] = [
  { kind: 'group_worship_service', label: 'GWS', pattern: /\b(gws|g w s|group worship)/ },
  { kind: 'extension', label: 'Extensions', pattern: /\b(ext|extensions?)\b/ },
  { kind: 'local_congregation', label: 'Local congregations', pattern: /\blocal (congregations?|chapels?)\b|\blokal\b/ },
];

// Spoken shorthands for region names.
const REGION_ALIASES: Record<string, string> = {
  ncr: 'National Capital Region',
  'metro manila': 'National Capital Region',
  armm: 'Autonomous Region In Muslim Mindanao',
  car: 'Cordillera Administrative Region',
  cordillera: 'Cordillera Administrative Region',
  australia: 'Australia & Oceania',
  oceania: 'Australia & Oceania',
};

export const normalizeSpeech = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9&' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Longest vocabulary entry spoken in the text ("central luzon" beats "central"). */
function longestMatch<T>(text: string, entries: { key: string; value: T }[]): { key: string; value: T } | null {
  let best: { key: string; value: T } | null = null;
  for (const e of entries) {
    if (e.key && new RegExp(`\\b${escapeRe(e.key)}\\b`).test(text) && (!best || e.key.length > best.key.length)) best = e;
  }
  return best;
}

/**
 * Classifies a spoken command. Navigation intents (region/district/type filters) are handled by the
 * app directly; questions (nearest, directions, schedules, anything else) go to the Ask assistant.
 */
export function parseVoiceIntent(raw: string, vocab: VoiceVocabulary): VoiceIntent {
  const text = normalizeSpeech(raw);
  const kindHit = KINDS.find((k) => k.pattern.test(text));
  const kind = kindHit ? { kind: kindHit.kind, label: kindHit.label } : null;

  if (/^(stop|cancel|close|never ?mind|that's all|thank you|thanks)\b/.test(text)) return { type: 'STOP', kind };
  if (/\b(directions?|direksyon|navigate|route|how do i get|take me)\b/.test(text)) return { type: 'GET_DIRECTIONS', kind };
  if (/\b(schedules?|iskedyul|worship|service times?|pagsamba|what time)\b/.test(text)) return { type: 'CHECK_SCHEDULE', kind };
  if (/\b(nearest|closest|near me|nearby|pinakamalapit|malapit)\b/.test(text)) return { type: 'FIND_NEAREST', kind };

  const regionHit = longestMatch(text, [
    ...vocab.regions.map((r) => ({ key: normalizeSpeech(r), value: r })),
    ...Object.entries(REGION_ALIASES).map(([key, value]) => ({ key, value })),
  ]);
  const districtHit = longestMatch(
    text,
    vocab.districts.map((d) => ({ key: normalizeSpeech(d.name), value: d }))
  );
  const saysRegion = /\bregion\b/.test(text);
  const saysDistrict = /\bdistri(ct|to)\b/.test(text);
  // An explicit "region"/"district" wins; otherwise the longer (more specific) name does.
  const pickRegion =
    regionHit && (saysRegion || !districtHit || (!saysDistrict && regionHit.key.length > districtHit.key.length));
  if (pickRegion) return { type: 'FILTER_REGION', kind, region: regionHit!.value };
  if (districtHit) return { type: 'FILTER_DISTRICT', kind, district: districtHit.value };
  if (kind && /\b(show|filter|list|only|all)\b/.test(text)) return { type: 'FILTER_KIND', kind };
  return { type: 'ASK', kind };
}

/**
 * Condenses an Ask reply for speaking: link text only, no URLs or emoji, and at most three list
 * items ("…and more on screen").
 */
export function replyForSpeech(reply: string): string {
  const lines = reply
    .split('\n')
    .map((l) =>
      l
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[📍🕒•]/gu, '')
        .replace(/ · /g, ', ')
        .replace(/\bmin\b/g, 'minutes')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
  const out: string[] = [];
  let items = 0;
  for (const line of lines) {
    const isItem = /^\d+\.\s/.test(line);
    if (isItem) {
      if (++items > 3) continue;
      out.push(line.replace(/^\d+\.\s/, '') + '.');
    } else if (items === 0 || out.length < 2) {
      if (/^open turn-by-turn directions:?$/i.test(line)) out.push('Tap Open in Maps for turn-by-turn directions.');
      else out.push(line);
    }
  }
  if (items > 3) out.push('More are listed on screen.');
  return out.join(' ').replace(/\.\./g, '.');
}
