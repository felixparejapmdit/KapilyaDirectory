import type { LocaleKind } from './types.ts';

// The official directory has no kind field: the kind is inferred from the locale NAME
// (rightmost marker wins; parentheticals such as "(Nagano-shi GWS)" name the parent, not this locale).
const GWS = /\b(?:G\.?\s?W\.?\s?S\.?|group\s+worship(?:\s+service)?)(?=[^A-Za-z]|$)/i;
const EXT = /\bext(?:ension)?\b\.?/i;

function lastMatchIndex(value: string, pattern: RegExp): number {
  let last = -1;
  for (const m of value.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) last = m.index ?? last;
  return last;
}

export function classifyLocaleName(rawName: string): LocaleKind {
  const core = rawName.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const g = lastMatchIndex(core, GWS);
  const e = lastMatchIndex(core, EXT);
  if (g < 0 && e < 0) return 'local_congregation';
  if (g >= 0 && e >= 0) return g > e ? 'group_worship_service' : 'extension';
  return g >= 0 ? 'group_worship_service' : 'extension';
}
