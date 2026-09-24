import { NextResponse } from 'next/server';
import { getSyncStatus, startSync } from '@/lib/sync-job';

export const dynamic = 'force-dynamic';

/** Current sync job state, last sync result, and next scheduled run. */
export async function GET() {
  return NextResponse.json(getSyncStatus());
}

/** Starts a full sync from the official directory in the background (Settings -> Run Sync Now). */
export async function POST() {
  const started = startSync('manual');
  return NextResponse.json({ started, ...getSyncStatus() }, { status: started ? 202 : 409 });
}
