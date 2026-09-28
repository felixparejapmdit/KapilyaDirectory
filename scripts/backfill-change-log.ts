/**
 * Rebuilds the change history (data/change-log.json) from git: every commit that touched
 * data/store.json is diffed against the one before it (each GitHub Action sync is a commit).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/backfill-change-log.ts
 *
 * Entries already in the log are kept; re-running doesn't duplicate them (ids are per sync and slug).
 */
import { execFileSync } from 'node:child_process';
import { appendChanges, diffLocales, readChangeLog, type ChangeEntry } from '../src/lib/change-log.ts';
import type { StoreData } from '../src/lib/store-files.ts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
const at = (sha: string): StoreData => JSON.parse(git('show', `${sha}:data/store.json`));

const commits = git('log', '--reverse', '--format=%H %cI', '--', 'data/store.json')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [sha, date] = line.split(' ');
    return { sha, date: new Date(date).toISOString() };
  });

const known = new Set(readChangeLog().entries.map((e) => e.id));
const found: ChangeEntry[] = [];
let before: StoreData | null = null;
for (const c of commits) {
  const after = at(c.sha);
  // The first full import has nothing to compare with (and tiny seed data isn't history).
  if (before && before.locales.length >= 1000) {
    const entries = diffLocales(before.locales, after.locales, after.districts, { at: c.date, source: 'history' }).filter((e) => !known.has(e.id));
    console.log(`${c.sha.slice(0, 7)} ${c.date}: ${entries.length} congregations changed`);
    found.push(...entries);
  }
  before = after;
}
appendChanges(found);
console.log(`\nAdded ${found.length} entries to data/change-log.json.`);
