import { NextRequest, NextResponse } from 'next/server';
import { readChangeLog, type ChangeEntry } from '@/lib/change-log';

/**
 * Directory change history (Settings → Change history): what changed per congregation in each sync.
 * ?q=bonifacio&action=updated&field=schedule&within=30d&offset=0&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    const log = readChangeLog();
    const q = (p.get('q') ?? '').trim().toLowerCase();
    const action = p.get('action');
    const field = p.get('field');
    const win = p.get('within')?.match(/^(\d{1,4})d$/);
    const since = win ? Date.now() - Number(win[1]) * 864e5 : NaN;

    const inRange = log.entries.filter((e) => Number.isNaN(since) || Date.parse(e.at) >= since);
    const searched = inRange.filter((e) => !q || `${e.name} ${e.district_name ?? ''} ${e.slug}`.toLowerCase().includes(q));
    const matches = searched.filter((e) => (!action || e.action === action) && (!field || e.changes.some((c) => c.field === field)));

    const count = (list: ChangeEntry[], key: (e: ChangeEntry) => string[]) => {
      const m: Record<string, number> = {};
      for (const e of list) for (const k of key(e)) m[k] = (m[k] ?? 0) + 1;
      return m;
    };
    const offset = Math.max(0, parseInt(p.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(p.get('limit') ?? '50', 10) || 50));
    return NextResponse.json(
      {
        updated_at: log.updated_at,
        total: matches.length,
        entries: matches.slice(offset, offset + limit),
        facets: {
          // Each ignores its own choice, so the other options stay visible.
          action: count(searched.filter((e) => !field || e.changes.some((c) => c.field === field)), (e) => [e.action]),
          field: count(searched.filter((e) => !action || e.action === action), (e) => [...new Set(e.changes.map((c) => c.field))]),
        },
        syncs: new Set(inRange.map((e) => e.at)).size,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
