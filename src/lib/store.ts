import fs from 'fs';
import path from 'path';
import {
  Region,
  District,
  Locale,
  DataSnapshot,
  DirectoryTotals,
  NextServiceStatus,
  WorldArea,
} from './types';
import { INITIAL_REGIONS, INITIAL_DISTRICTS, INITIAL_LOCALES, INITIAL_SNAPSHOT } from './seed-data';
import { haversineKm } from './geo';
import { formatTime12Hour } from './time';
import { findNextService, formatCountdown } from './next-service';
import {
  type StoreData,
  type SyncSummary,
  SNAPSHOTS_DIR,
  ensureDataDirs,
  readStoreFile,
  storeFileMtime,
  writeSnapshot,
  writeStoreFile,
} from './store-files';

class KapilyaStore {
  private data: StoreData | null = null;
  private loadedMtime: number | null = null;
  private cachedTotals: DirectoryTotals | null = null;

  private load(): StoreData {
    // Reload when store.json changed on disk (CLI sync, or another server bundle wrote it).
    const mtime = storeFileMtime();
    if (this.data && mtime === this.loadedMtime) {
      return this.data;
    }

    ensureDataDirs();

    if (mtime !== null) {
      try {
        this.data = readStoreFile();
        this.loadedMtime = mtime;
        this.cachedTotals = null;
        return this.data!;
      } catch (err) {
        if (this.data) return this.data;
        console.error('Failed to read store.json, falling back to seed:', err);
      }
    }

    // Initialize with seed data
    this.data = {
      regions: [...INITIAL_REGIONS],
      districts: [...INITIAL_DISTRICTS],
      locales: [...INITIAL_LOCALES],
      snapshots: [INITIAL_SNAPSHOT],
      last_updated: new Date().toISOString(),
    };

    this.save();
    return this.data;
  }

  public save() {
    if (!this.data) return;
    writeStoreFile(this.data);
    this.loadedMtime = storeFileMtime();
    this.cachedTotals = null;
  }

  // --- Regions ---
  public getRegions(): Region[] {
    const data = this.load();
    return [...data.regions].sort((a, b) => a.sort_order - b.sort_order);
  }

  public getGroupedRegions() {
    const data = this.load();
    const districts = data.districts;

    const areaOrder: WorldArea[] = ['americas', 'asia', 'europe', 'australia_oceania', 'africa', 'philippines'];
    const areaTitles: Record<WorldArea, string> = {
      americas: 'Americas',
      asia: 'Asia',
      europe: 'Europe',
      australia_oceania: 'Australia & Oceania',
      africa: 'Africa',
      philippines: 'Philippines Regions',
    };

    return areaOrder.map((areaKey) => {
      const regionsInArea = data.regions
        .filter((r) => r.world_area === areaKey)
        .sort((a, b) => a.sort_order - b.sort_order);

      const items = regionsInArea.map((reg) => {
        const regDistricts = districts
          .filter((d) => d.region_id === reg.id)
          .map((d) => ({
            ...d,
            locale_count: data.locales.filter((l) => l.district_id === d.id).length,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          region: reg,
          districts: regDistricts,
        };
      });

      return {
        area: areaKey,
        title: areaTitles[areaKey],
        regions: items,
      };
    });
  }

  // --- Districts ---
  public getDistricts(): District[] {
    const data = this.load();
    return data.districts.map((d) => ({
      ...d,
      locale_count: data.locales.filter((l) => l.district_id === d.id).length,
    }));
  }

  public getDistrictBySlug(slug: string): (District & { locales: Locale[]; region?: Region }) | null {
    const data = this.load();
    const district = data.districts.find((d) => d.slug === slug || d.id === slug);
    if (!district) return null;

    const region = data.regions.find((r) => r.id === district.region_id);
    const locales = data.locales
      .filter((l) => l.district_id === district.id)
      .map((l) => ({
        ...l,
        district_name: district.name,
        district_slug: district.slug,
        timezone: district.timezone,
      }));

    return {
      ...district,
      region,
      locale_count: locales.length,
      locales,
    };
  }

  // --- Locales & Near-Me Search ---
  public getLocaleById(id: string): Locale | null {
    const data = this.load();
    const locale = data.locales.find((l) => l.id === id || l.slug === id);
    if (!locale) return null;

    const district = data.districts.find((d) => d.id === locale.district_id);
    return {
      ...locale,
      district_name: district?.name,
      district_slug: district?.slug,
      timezone: district?.timezone || 'Asia/Manila',
    };
  }

  public searchNearby(params: {
    lat: number;
    lng: number;
    radiusKm?: number;
    day?: number; // 0-6
    startTime?: string;
    endTime?: string;
    language?: string;
    kind?: string;
    query?: string;
    limit?: number;
  }): Locale[] {
    const data = this.load();
    const radius = params.radiusKm ?? 50;
    const districtById = new Map(data.districts.map((d) => [d.id, d]));

    // Fast bounding box pre-filter (eliminates 98% of points in nanoseconds)
    const latDiff = radius / 110.574;
    const cosLat = Math.cos((params.lat * Math.PI) / 180);
    const lngDiff = radius / Math.max(24, 111.32 * Math.abs(cosLat));

    let results: (Locale & { distance_km: number })[] = [];

    for (const locale of data.locales) {
      // Spatial Bounding Box quick test
      if (
        Math.abs(locale.latitude - params.lat) > latDiff ||
        Math.abs(locale.longitude - params.lng) > lngDiff
      ) {
        continue;
      }

      const km = haversineKm(params.lat, params.lng, locale.latitude, locale.longitude);

      if (km <= radius) {
        const district = districtById.get(locale.district_id);

        results.push({
          ...locale,
          district_name: district?.name,
          district_slug: district?.slug,
          timezone: district?.timezone || 'Asia/Manila',
          distance_km: km,
        });
      }
    }

    // Sort by distance (nearest first)
    results.sort((a, b) => a.distance_km - b.distance_km);

    // Filter by kind
    if (params.kind && params.kind !== 'all') {
      results = results.filter((l) => l.kind === params.kind);
    }

    // Filter by language
    if (params.language && params.language !== 'all') {
      const langLower = params.language.toLowerCase();
      results = results.filter((l) =>
        l.languages.some((lang) => lang.toLowerCase().includes(langLower))
      );
    }

    // Filter by text query (name or address)
    if (params.query && params.query.trim()) {
      const q = params.query.toLowerCase().trim();
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          (l.district_name && l.district_name.toLowerCase().includes(q))
      );
    }

    // Filter by day of week or schedule
    if (params.day !== undefined && params.day !== null && !isNaN(params.day)) {
      results = results.filter((l) =>
        l.schedule?.some((s) => s.day_of_week === Number(params.day))
      );
    }

    // Apply limit if specified
    if (params.limit && params.limit > 0) {
      return results.slice(0, params.limit);
    }

    return results;
  }

  // --- Next Service Status ---
  public getNextService(userLat?: number, userLng?: number): NextServiceStatus | null {
    const data = this.load();
    const now = new Date();

    // Pick top 15 nearest candidate locales for lightning fast calculation
    let candidateLocales: Locale[] = [];
    if (userLat && userLng) {
      candidateLocales = this.searchNearby({ lat: userLat, lng: userLng, radiusKm: 80, limit: 15 });
    }
    if (candidateLocales.length === 0) {
      candidateLocales = data.locales.slice(0, 15);
    }

    let nearestUpcoming: { locale: Locale; next: NonNullable<ReturnType<typeof findNextService>> } | null = null;

    for (const locale of candidateLocales) {
      // Evaluated on the locale's own clock (its district's timezone).
      const next = findNextService(locale.schedule, locale.timezone, now);
      if (next && (!nearestUpcoming || next.startsInMinutes < nearestUpcoming.next.startsInMinutes)) {
        nearestUpcoming = { locale, next };
      }
    }

    if (!nearestUpcoming) return null;

    const diff = nearestUpcoming.next.startsInMinutes;
    const item = nearestUpcoming.next.item;
    const statusText =
      diff <= 0
        ? 'Service ongoing'
        : diff < 24 * 60
          ? `starts ${formatCountdown(diff)}`
          : `next ${item.day_name} at ${formatTime12Hour(item.start_time)}`;

    return {
      locale: nearestUpcoming.locale,
      scheduleItem: item,
      startsInMinutes: diff,
      statusText,
      isImminent: diff <= 60,
    };
  }

  // --- Directory Totals & Health ---
  public getTotals(): DirectoryTotals {
    const data = this.load();
    if (this.cachedTotals) {
      return this.cachedTotals;
    }

    const locales = data.locales;

    this.cachedTotals = {
      regions: data.regions.length,
      districts: data.districts.length,
      locales: locales.filter((l) => l.kind === 'local_congregation').length,
      extensions: locales.filter((l) => l.kind === 'extension').length,
      group_worship_services: locales.filter((l) => l.kind === 'group_worship_service').length,
      last_updated: data.last_updated,
      last_snapshot_id: data.snapshots[0]?.id || 'snap-seed-v1',
    };

    return this.cachedTotals;
  }

  // --- Directory Sync ---
  /** Current districts and locales, for the sync job to diff against. */
  public getRawData(): { districts: District[]; locales: Locale[] } {
    const data = this.load();
    return { districts: data.districts, locales: data.locales };
  }

  public getLastSync(): SyncSummary | null {
    return this.load().last_sync ?? null;
  }

  /** Snapshots the current state, then replaces all locales with the synced records. */
  public applySync(locales: Locale[], summary: SyncSummary) {
    const data = this.load();
    writeSnapshot(data, `Automatic pre-sync snapshot (${summary.trigger} sync)`);
    data.locales = locales;
    data.last_updated = summary.finished_at;
    data.last_sync = summary;
    this.save();
  }

  /** Records a sync attempt that changed no data (e.g. the source was unreachable). */
  public recordSync(summary: SyncSummary) {
    const data = this.load();
    data.last_sync = summary;
    this.save();
  }

  // --- Snapshots ---
  public getSnapshots(): DataSnapshot[] {
    const data = this.load();
    return data.snapshots;
  }

  public createSnapshot(description?: string): DataSnapshot {
    const data = this.load();
    const snapshot = writeSnapshot(data, description || `Snapshot created on ${new Date().toLocaleDateString()}`);
    this.save();
    return snapshot;
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const data = this.load();
    const snapshot = data.snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return false;

    const fileName = `snapshot-${snapshotId}.json`;
    const snapshotPath = path.join(SNAPSHOTS_DIR, fileName);

    if (!fs.existsSync(snapshotPath)) {
      // If seed snapshot
      if (snapshotId === INITIAL_SNAPSHOT.id) {
        this.data = {
          regions: [...INITIAL_REGIONS],
          districts: [...INITIAL_DISTRICTS],
          locales: [...INITIAL_LOCALES],
          snapshots: data.snapshots,
          last_updated: new Date().toISOString(),
          last_sync: data.last_sync,
        };
        this.save();
        return true;
      }
      return false;
    }

    try {
      const restored = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
      this.data = {
        ...restored,
        snapshots: data.snapshots,
        last_updated: new Date().toISOString(),
        last_sync: data.last_sync,
      };
      this.save();
      return true;
    } catch (err) {
      console.error('Error restoring snapshot:', err);
      return false;
    }
  }
}

export const kapilyaStore = new KapilyaStore();
