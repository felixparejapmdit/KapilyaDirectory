/**
 * On-disk layout of the directory store (data/store.json + data/snapshots/).
 * Free of app imports so the standalone sync script can share it with the Next.js server.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DataSnapshot, District, Locale, Region } from './types.ts';

export interface SyncSummary {
  finished_at: string;
  trigger: 'manual' | 'scheduled' | 'cli';
  status: 'success' | 'partial' | 'failed';
  message: string;
  locales_total: number;
  updated: number;
  added: number;
  removed: number;
  fetch_failures: number;
  duration_ms: number;
}

export interface StoreData {
  regions: Region[];
  districts: District[];
  locales: Locale[];
  snapshots: DataSnapshot[];
  last_updated: string;
  last_sync?: SyncSummary;
}

export const DATA_DIR = path.join(process.cwd(), 'data');
export const STORE_FILE = path.join(DATA_DIR, 'store.json');
export const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
export const MAX_SNAPSHOTS = 30;

export function ensureDataDirs() {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

export function storeFileMtime(): number | null {
  try {
    return fs.statSync(STORE_FILE).mtimeMs;
  } catch {
    return null;
  }
}

export function readStoreFile(): StoreData {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
}

export function writeStoreFile(data: StoreData) {
  ensureDataDirs();
  // Write-then-rename so a concurrent reader never sees a half-written file.
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, STORE_FILE);
}

/**
 * Saves the full current state as a restorable snapshot and records it (newest first) in
 * `data.snapshots`. Snapshot files that fall off the end of the list are deleted.
 */
export function writeSnapshot(data: StoreData, description: string): DataSnapshot {
  ensureDataDirs();
  const snapshotId = `snap-${Date.now()}`;
  const fileName = `snapshot-${snapshotId}.json`;
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, fileName), JSON.stringify(data, null, 2), 'utf-8');

  const snapshot: DataSnapshot = {
    id: snapshotId,
    created_at: new Date().toISOString(),
    storage_url: `/data/snapshots/${fileName}`,
    record_counts: {
      regions: data.regions.length,
      districts: data.districts.length,
      locales: data.locales.filter((l) => l.kind === 'local_congregation').length,
      extensions: data.locales.filter((l) => l.kind === 'extension').length,
      group_worship_services: data.locales.filter((l) => l.kind === 'group_worship_service').length,
      schedules: data.locales.reduce((acc, l) => acc + (l.schedule?.length || 0), 0),
    },
    status: 'success',
    description,
  };

  data.snapshots.unshift(snapshot);
  for (const evicted of data.snapshots.splice(MAX_SNAPSHOTS)) {
    fs.rmSync(path.join(SNAPSHOTS_DIR, `snapshot-${evicted.id}.json`), { force: true });
  }
  return snapshot;
}
