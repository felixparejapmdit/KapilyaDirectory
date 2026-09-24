/**
 * Syncs data/store.json with the official INC directory (directory.iglesianicristo.net):
 * names, kinds, addresses, coordinates, contacts and worship schedules for every locale.
 * The running app does the same from Settings -> Run Sync Now and nightly at 12:00 AM.
 *
 *   npm run sync:directory -- [--dry-run] [--concurrency=6] [--only=slug1,slug2]
 *                             [--cache-dir=<dir>] [--report=<file>]
 *
 * --cache-dir keeps raw HTML so a rerun only fetches pages that are not cached yet.
 * Unless --dry-run, the current store is snapshotted (restorable from Settings) before writing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { syncFromSource } from '../src/lib/sync.ts';
import { STORE_FILE, readStoreFile, writeSnapshot, writeStoreFile, type SyncSummary } from '../src/lib/store-files.ts';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'] as [string, string];
  })
);
const DRY_RUN = args.get('dry-run') === 'true';
const CONCURRENCY = Number(args.get('concurrency') ?? 6);
const ONLY = args.get('only')?.split(',').filter(Boolean);
const CACHE_DIR = args.get('cache-dir') ? path.resolve(args.get('cache-dir')!) : null;
const REPORT_FILE = args.get('report') ? path.resolve(args.get('report')!) : null;

async function main() {
  const started = Date.now();
  const data = readStoreFile();
  console.log(`Store: ${STORE_FILE} (${data.districts.length} districts, ${data.locales.length} locales)`);
  if (CACHE_DIR) console.log(`HTML cache: ${CACHE_DIR}`);

  let lastLog = 0;
  const { locales, report } = await syncFromSource(data, {
    concurrency: CONCURRENCY,
    only: ONLY,
    cacheDir: CACHE_DIR,
    onProgress: (p) => {
      if (Date.now() - lastLog > 10_000 || p.done === p.total) {
        lastLog = Date.now();
        console.log(`  [${p.phase}] ${p.done}/${p.total}`);
      }
    },
  });

  if (REPORT_FILE) {
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  }

  const failures = report.fetch_failures.length + report.district_failures.length;
  console.log('\nSummary');
  console.log(`  pages fetched:    ${report.pages_fetched}`);
  console.log(`  fetch failures:   ${failures}`);
  console.log(`  updated:          ${report.updated}`);
  console.log(`  unchanged:        ${report.unchanged}`);
  console.log(`  added:            ${report.added.length}`);
  console.log(`  removed:          ${report.removed.length}`);
  console.log(`  empty schedules:  ${report.empty_schedules.length}`);
  console.log(`  parse warnings:   ${report.parse_warnings.length}`);

  if (DRY_RUN) {
    console.log('\nDry run: store not modified.');
    return;
  }
  if (report.pages_fetched === 0) {
    console.log('\nNothing fetched; store not modified.');
    process.exitCode = 1;
    return;
  }

  const summary: SyncSummary = {
    finished_at: new Date().toISOString(),
    trigger: 'cli',
    status: failures === 0 ? 'success' : 'partial',
    message: `Synced ${report.pages_fetched.toLocaleString()} locales from the official directory${failures ? `; ${failures} pages kept their previous data` : ''}.`,
    locales_total: locales.length,
    updated: report.updated,
    added: report.added.length,
    removed: report.removed.length,
    fetch_failures: failures,
    duration_ms: Date.now() - started,
  };
  const snapshot = writeSnapshot(data, 'Automatic pre-sync snapshot (cli sync)');
  data.locales = locales;
  data.last_updated = summary.finished_at;
  data.last_sync = summary;
  writeStoreFile(data);
  console.log(`\nSaved. Pre-sync snapshot: ${snapshot.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
