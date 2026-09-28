/**
 * Change history of the directory (data/change-log.json, committed with store.json so the deployed
 * site can show it). Every sync, restore, and CLI sync diffs the old records against the new ones and
 * keeps what changed per congregation: name, type, address, map location, contacts, district, and
 * worship schedule (services removed and added). Newest first, capped at MAX_CHANGE_ENTRIES.
 *
 * Free of app imports so the standalone sync script can use it too.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { District, Locale, WorshipScheduleItem } from './types.ts';
import { DATA_DIR, READ_ONLY_DEPLOYMENT } from './store-files.ts';
import { haversineKm } from './geo.ts';
import { formatTime12Hour, timeToMinutes } from './time.ts';

export const CHANGE_LOG_FILE = path.join(DATA_DIR, 'change-log.json');
export const MAX_CHANGE_ENTRIES = 5000;

export type ChangeField = 'name' | 'kind' | 'address' | 'location' | 'schedule' | 'phone' | 'email' | 'district';
export type ChangeAction = 'added' | 'removed' | 'updated';
/** scheduled/manual = the app's own sync, cli = scripts/sync-directory.ts (GitHub Action), history = rebuilt from git. */
export type ChangeSource = 'scheduled' | 'manual' | 'cli' | 'restore' | 'history';

export interface FieldChange {
  field: ChangeField;
  old: string | null;
  new: string | null;
  /** Schedule: services no longer listed / newly listed. */
  removed?: string[];
  added?: string[];
  /** Map location: how far the pin moved. */
  moved_km?: number;
}

export interface ChangeEntry {
  id: string;
  /** When the change was picked up (sync time). */
  at: string;
  source: ChangeSource;
  action: ChangeAction;
  locale_id: string;
  slug: string;
  name: string;
  kind: Locale['kind'];
  district_id: string;
  district_name?: string;
  changes: FieldChange[];
}

export interface ChangeLog {
  updated_at: string | null;
  entries: ChangeEntry[];
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND_LABEL: Record<Locale['kind'], string> = {
  local_congregation: 'Local congregation',
  extension: 'Extension',
  group_worship_service: 'Group Worship Service (GWS)',
};

/** "Sun 6:00 AM · Tagalog / Tagalog Sign · CWS" */
export function describeService(i: WorshipScheduleItem): string {
  const lang = [i.language, i.language2].filter((l) => l && l !== 'Unspecified').join(' / ');
  return [`${DAY[i.day_of_week]} ${formatTime12Hour(i.start_time)}`, lang, i.is_cws || i.service_type === 'CWS' ? 'CWS' : ''].filter(Boolean).join(' · ');
}

/** Services in week order (Monday first, like the official directory). */
function scheduleLines(l: Locale): string[] {
  return [...(l.schedule ?? [])]
    .sort((a, b) => ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7) || timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
    .map(describeService);
}

const coords = (l: Locale) => `${l.latitude.toFixed(5)}, ${l.longitude.toFixed(5)}`;
const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function diffOne(before: Locale, after: Locale, districtName: (id: string) => string | undefined): FieldChange[] {
  const changes: FieldChange[] = [];
  const simple = (field: ChangeField, a: string | null, b: string | null) => {
    if (a !== b) changes.push({ field, old: a, new: b });
  };
  simple('name', text(before.name), text(after.name));
  simple('kind', KIND_LABEL[before.kind], KIND_LABEL[after.kind]);
  simple('district', districtName(before.district_id) ?? before.district_id, districtName(after.district_id) ?? after.district_id);
  simple('address', text(before.address), text(after.address));
  if (coords(before) !== coords(after)) {
    const km = haversineKm(before.latitude, before.longitude, after.latitude, after.longitude);
    changes.push({ field: 'location', old: coords(before), new: coords(after), moved_km: Math.round(km * 100) / 100 });
  }
  simple('phone', text(before.phone), text(after.phone));
  simple('email', text(before.email), text(after.email));
  const a = scheduleLines(before);
  const b = scheduleLines(after);
  if (a.join('\n') !== b.join('\n')) {
    const removed = a.filter((x) => !b.includes(x));
    const added = b.filter((x) => !a.includes(x));
    changes.push({ field: 'schedule', old: a.join('; ') || null, new: b.join('; ') || null, removed, added });
  }
  return changes;
}

/** What changed between two versions of the directory, one entry per congregation. */
export function diffLocales(
  before: Locale[],
  after: Locale[],
  districts: District[],
  meta: { at: string; source: ChangeSource }
): ChangeEntry[] {
  const names = new Map(districts.map((d) => [d.id, d.name]));
  const districtName = (id: string) => names.get(id);
  const old = new Map(before.map((l) => [l.id, l]));
  const now = new Map(after.map((l) => [l.id, l]));
  const stamp = Date.parse(meta.at) || Date.now();
  const entries: ChangeEntry[] = [];
  const entry = (l: Locale, action: ChangeAction, changes: FieldChange[]): ChangeEntry => ({
    id: `chg-${stamp}-${l.slug}`,
    at: meta.at,
    source: meta.source,
    action,
    locale_id: l.id,
    slug: l.slug,
    name: l.name,
    kind: l.kind,
    district_id: l.district_id,
    district_name: districtName(l.district_id),
    changes,
  });

  for (const l of after) {
    const prev = old.get(l.id);
    if (!prev) {
      entries.push(
        entry(l, 'added', [
          { field: 'address', old: null, new: text(l.address) },
          { field: 'location', old: null, new: coords(l) },
          { field: 'schedule', old: null, new: scheduleLines(l).join('; ') || null, removed: [], added: scheduleLines(l) },
        ])
      );
      continue;
    }
    const changes = diffOne(prev, l, districtName);
    if (changes.length) entries.push(entry(l, 'updated', changes));
  }
  for (const l of before) {
    if (!now.has(l.id)) {
      entries.push(
        entry(l, 'removed', [
          { field: 'address', old: text(l.address), new: null },
          { field: 'schedule', old: scheduleLines(l).join('; ') || null, new: null, removed: scheduleLines(l), added: [] },
        ])
      );
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function readChangeLog(file = CHANGE_LOG_FILE): ChangeLog {
  try {
    const log = JSON.parse(fs.readFileSync(file, 'utf-8')) as ChangeLog;
    return { updated_at: log.updated_at ?? null, entries: Array.isArray(log.entries) ? log.entries : [] };
  } catch {
    return { updated_at: null, entries: [] };
  }
}

/** Adds entries (newest first) and keeps the latest MAX_CHANGE_ENTRIES. No-op on a read-only deployment. */
export function appendChanges(entries: ChangeEntry[], file = CHANGE_LOG_FILE): void {
  if (!entries.length || READ_ONLY_DEPLOYMENT) return;
  const log = readChangeLog(file);
  const merged = [...entries, ...log.entries]
    .sort((a, b) => b.at.localeCompare(a.at) || a.name.localeCompare(b.name))
    .slice(0, MAX_CHANGE_ENTRIES);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ updated_at: new Date().toISOString(), entries: merged }, null, 1), 'utf-8');
}
