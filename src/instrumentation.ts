/** Runs once when the Next.js server starts: schedules the nightly directory sync. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startNightlyScheduler } = await import('./lib/sync-job');
    startNightlyScheduler();
  }
}
