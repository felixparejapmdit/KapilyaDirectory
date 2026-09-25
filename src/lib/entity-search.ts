/**
 * Fuzzy name resolution for free text and speech ("Bonifacio the vibe schedule" -> Bonifacio Drive).
 *
 * Speech recognition mishears words ("Drive" -> "the vibe"), so names are matched token by token
 * with typo tolerance, filler words ("schedule", "directions", "the", "ng", ...) are ignored, and
 * among similar names the one closest to the user wins.
 */
import type { District, Locale } from './types.ts';
import { haversineKm } from './geo.ts';

// Words that describe the request rather than name a place.
const FILLER = new Set(
  (
    'a an the of for to at in on is are was what whats what\'s when where which who how me my i you your us please ' +
    'show tell give get find locate open see check list display search look ' +
    'schedule schedules sched iskedyul time times worship service services pagsamba oras mass ' +
    'direction directions navigate navigation route go going take ' +
    'address location located phone number contact ' +
    'chapel chapels church kapilya lokal local locale congregation congregations near nearest nearby closest ' +
    'today tomorrow tonight morning evening sunday monday tuesday wednesday thursday friday saturday ' +
    'ng sa ang mga kay ni po ba ano saan kailan paano ' +
    'hey assistant ok okay hi hello thanks thank ' +
    'one ones it there that this those here about any some all also next soonest earliest first ' +
    'ext exts extension extensions gws group ' +
    'english tagalog filipino cebuano bisaya visayan ilocano ilokano hiligaynon ilonggo spanish italian german french portuguese japanese nihongo korean sign language'
  ).split(' ')
);

// Generic words inside names that shouldn't carry a match on their own.
const WEAK_NAME_TOKENS = new Set(['ext', 'extension', 'gws', 'group', 'worship', 'service', 'city', 'of', 'the', 'de', 'del', 'la', 'san', 'sta', 'santa', 'sto', 'santo', 'st', 'new', 'old']);

export const tokenize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Levenshtein distance with an early exit above `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Similarity of two tokens, 0..1 (exact, prefix, or typo-tolerant). */
function tokenSimilarity(q: string, n: string): number {
  if (q === n) return 1;
  // Short words ("one", "st") only count when exact.
  if (q.length < 4) return 0;
  if (n.startsWith(q)) return 0.9;
  if (n.length >= 4 && q.startsWith(n)) return 0.85;
  const longest = Math.max(q.length, n.length);
  const max = longest <= 5 ? 2 : 3;
  const d = editDistance(q, n, max);
  return d > max ? 0 : Math.max(0, 1 - d / longest);
}

interface IndexedName<T> {
  item: T;
  tokens: string[];
  strong: string[];
  /** Name without spaces/hyphens ("Pag-asa" -> "pagasa"), for run-together speech. */
  joined: string;
}

export interface NameIndex {
  locales: IndexedName<Locale>[];
  districts: IndexedName<District>[];
}

export function buildNameIndex(locales: Locale[], districts: District[]): NameIndex {
  const index = <T>(item: T, name: string): IndexedName<T> => {
    const tokens = tokenize(name);
    const strong = tokens.filter((t) => !WEAK_NAME_TOKENS.has(t));
    return { item, tokens, strong: strong.length ? strong : tokens, joined: (strong.length ? strong : tokens).join('') };
  };
  return {
    locales: locales.map((l) => index(l, l.name)),
    districts: districts.map((d) => index(d, d.name)),
  };
}

/** Content words of a query (filler removed). */
export function queryTokens(query: string): string[] {
  return tokenize(query).filter((t) => !FILLER.has(t));
}

function scoreName(q: string[], entry: { tokens: string[]; strong: string[] }): number {
  if (!q.length || !entry.strong.length) return 0;
  const qBest = q.map((qt) => Math.max(...entry.tokens.map((nt) => tokenSimilarity(qt, nt))));
  const nBest = entry.strong.map((nt) => Math.max(...q.map((qt) => tokenSimilarity(qt, nt))));
  // A name must have at least one strong token matched well.
  if (Math.max(...nBest) < 0.8) return 0;
  // Speech often garbles one word of a name ("Drive" -> "vibe"): pair leftover words on both
  // sides and give them partial credit.
  const unmatchedQ = qBest.filter((v) => v < 0.5).length;
  const unmatchedN = nBest.filter((v) => v < 0.5).length;
  const aligned = Math.min(unmatchedQ, unmatchedN);
  const credit = 0.35 * aligned;
  const said = (qBest.reduce((a, b) => a + b, 0) + credit) / q.length;
  const covered = (nBest.reduce((a, b) => a + b, 0) + credit) / entry.strong.length;
  return 0.55 * said + 0.45 * covered;
}

export interface Match<T> {
  item: T;
  score: number;
}

/**
 * Best locale matches for the query. Near-equal scores are ordered by distance from `origin`
 * (the same name exists in several provinces).
 */
export function matchLocales(
  index: NameIndex,
  query: string,
  origin?: { lat: number; lng: number } | null,
  minScore = 0.62
): Match<Locale>[] {
  const q = queryTokens(query);
  if (!q.length) return [];
  const hits: (Match<Locale> & { km: number })[] = [];
  const qJoined = q.length > 1 ? [q.join('')] : null;
  for (const entry of index.locales) {
    let score = scoreName(q, entry);
    // "pagasa" vs "Pag-asa", "pag asa" vs "Pagasa": also compare the run-together forms.
    if (score < 0.9 && (entry.strong.length > 1 || qJoined)) {
      const joinedEntry = { tokens: [entry.joined], strong: [entry.joined] };
      // Only exact run-together matches count ("bonifacio vibe" must not read as a longer "Bonifacio").
      const joinedScore = Math.max(scoreName(q, joinedEntry), qJoined ? scoreName(qJoined, joinedEntry) : 0);
      if (joinedScore >= 0.97) score = Math.max(score, joinedScore);
    }
    if (score >= minScore) {
      const km = origin ? haversineKm(origin.lat, origin.lng, entry.item.latitude, entry.item.longitude) : 0;
      hits.push({ item: entry.item, score, km });
    }
  }
  // Up to +0.12 for being close (fading to 0 at ~1,500 km): the same or a similar name often exists in
  // several provinces, and people mostly ask about congregations near them.
  const adjusted = (h: { score: number; km: number }) => h.score + (origin ? 0.12 * Math.max(0, 1 - Math.log10(1 + h.km) / 3.2) : 0);
  return hits.sort((a, b) => adjusted(b) - adjusted(a)).map(({ item, score }) => ({ item, score }));
}

export function matchDistricts(index: NameIndex, query: string, minScore = 0.7): Match<District>[] {
  const q = queryTokens(query);
  if (!q.length) return [];
  return index.districts
    .map((entry) => ({ item: entry.item, score: scoreName(q, entry) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
