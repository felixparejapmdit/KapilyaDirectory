/**
 * Background directory-sync job for the running server (Settings -> Run Sync Now, and the
 * nightly schedule). State lives on globalThis so every route bundle shares one job.
 */
import { kapilyaStore } from './store';
import { syncFromSource, type SyncPhase } from './sync';
import { READ_ONLY_DEPLOYMENT, type SyncSummary } from './store-files';

export const SYNC_TIMEZONE = process.env.SYNC_TIMEZONE || 'Asia/Manila';

export interface SyncJobStatus {
  state: 'idle' | 'running';
  /** True on serverless hosts (Vercel): data is updated by syncing locally and redeploying. */
  read_only: boolean;
  trigger: SyncSummary['trigger'] | null;
  phase: SyncPhase | null;
  done: number;
  total: number;
  started_at: string | null;
  last_sync: SyncSummary | null;
  next_scheduled_at: string | null;
  timezone: string;
}

interface JobState {
  running: boolean;
  trigger: SyncSummary['trigger'] | null;
  phase: SyncPhase | null;
  done: number;
  total: number;
  startedAt: number | null;
  lastScheduledDate: string | null;
  schedulerStarted: boolean;
}

const g = globalThis as typeof globalThis & { __kapilyaSyncJob?: JobState };
const job: JobState = (g.__kapilyaSyncJob ??= {
  running: false,
  trigger: null,
  phase: null,
  done: 0,
  total: 0,
  startedAt: null,
  lastScheduledDate: null,
  schedulerStarted: false,
});

/** Wall-clock date/time parts for `tz` ("2026-09-25", 0..23, 0..59). */
function zonedNow(tz: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function nextMidnight(tz = SYNC_TIMEZONE, now = new Date()): Date {
  const z = zonedNow(tz, now);
  const secondsLeft = 24 * 3600 - (z.hour * 3600 + z.minute * 60 + z.second);
  return new Date(now.getTime() + secondsLeft * 1000);
}

export function getSyncStatus(): SyncJobStatus {
  return {
    state: job.running ? 'running' : 'idle',
    read_only: READ_ONLY_DEPLOYMENT,
    trigger: job.trigger,
    phase: job.phase,
    done: job.done,
    total: job.total,
    started_at: job.startedAt ? new Date(job.startedAt).toISOString() : null,
    last_sync: kapilyaStore.getLastSync(),
    next_scheduled_at: job.schedulerStarted ? nextMidnight().toISOString() : null,
    timezone: SYNC_TIMEZONE,
  };
}

/** Starts a full sync in the background. Returns false if one is already running. */
export function startSync(trigger: SyncSummary['trigger']): boolean {
  if (job.running || READ_ONLY_DEPLOYMENT) return false;
  Object.assign(job, { running: true, trigger, phase: 'districts', done: 0, total: 0, startedAt: Date.now() });

  void (async () => {
    const started = job.startedAt!;
    try {
      const { districts, locales } = kapilyaStore.getRawData();
      const { locales: next, report } = await syncFromSource(
        { districts, locales },
        {
          onProgress: (p) => Object.assign(job, { phase: p.phase, done: p.done, total: p.total }),
        }
      );
      const failures = report.fetch_failures.length + report.district_failures.length;
      const summary: SyncSummary = {
        finished_at: new Date().toISOString(),
        trigger,
        status: failures === 0 ? 'success' : 'partial',
        message:
          failures === 0
            ? `Synced ${report.pages_fetched.toLocaleString()} locales from the official directory.`
            : `Synced ${report.pages_fetched.toLocaleString()} locales; ${failures} pages could not be fetched and kept their previous data.`,
        locales_total: next.length,
        updated: report.updated,
        added: report.added.length,
        removed: report.removed.length,
        fetch_failures: failures,
        duration_ms: Date.now() - started,
      };
      if (report.pages_fetched === 0) {
        kapilyaStore.recordSync({ ...summary, status: 'failed', message: 'The official directory could not be reached. No data was changed.' });
      } else {
        kapilyaStore.applySync(next, summary);
      }
    } catch (err) {
      kapilyaStore.recordSync({
        finished_at: new Date().toISOString(),
        trigger,
        status: 'failed',
        message: `Sync failed: ${(err as Error).message}`,
        locales_total: 0,
        updated: 0,
        added: 0,
        removed: 0,
        fetch_failures: 0,
        duration_ms: Date.now() - started,
      });
    } finally {
      Object.assign(job, { running: false, phase: null });
    }
  })();

  return true;
}

/** Checks every 30 s and starts a sync once per day at 12:00 AM in SYNC_TIMEZONE. */
export function startNightlyScheduler() {
  if (job.schedulerStarted || process.env.KAPILYA_NIGHTLY_SYNC === 'off' || READ_ONLY_DEPLOYMENT) return;
  job.schedulerStarted = true;
  const timer = setInterval(() => {
    const z = zonedNow(SYNC_TIMEZONE);
    if (z.hour === 0 && z.minute < 5 && job.lastScheduledDate !== z.date) {
      job.lastScheduledDate = z.date;
      startSync('scheduled');
    }
  }, 30_000);
  timer.unref?.();
  console.log(`[sync] Nightly directory sync scheduled for 12:00 AM ${SYNC_TIMEZONE}`);
}
