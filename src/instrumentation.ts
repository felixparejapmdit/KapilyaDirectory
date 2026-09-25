/** Runs once when the Next.js server starts: schedules the 6-hourly directory sync. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutoSyncScheduler } = await import('./lib/sync-job');
    startAutoSyncScheduler();
  }
}
