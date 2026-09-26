import { NextRequest, NextResponse, after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ACCESS_STORAGE, CAPACITY, clearAccess, queryAccess, readAccess, recordAccess } from '@/lib/access-log';
import type { AccessEntry, AccessFilters } from '@/lib/access-log-types';
import { checkAdmin } from '@/lib/admin-auth';
import { parseUserAgent } from '@/lib/user-agent';

/** Short, printable text from the page's beacon (never trusted beyond that). */
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) || undefined : undefined;

const header = (req: NextRequest, name: string) => {
  const v = req.headers.get(name);
  if (!v) return undefined;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

function clientIp(req: NextRequest): string {
  const raw = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '';
  return raw.trim().replace(/^::ffff:/, '') || 'unknown';
}

/** Records one page view. Called by every page (see AccessBeacon); IP, location, and browser come from the request. */
export async function POST(request: NextRequest) {
  if (ACCESS_STORAGE === 'none') return new NextResponse(null, { status: 204 });
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const path = clean(body.path, 200);
  const vid = clean(body.vid, 32);
  if (!path?.startsWith('/') || !vid || !/^[a-z0-9]+$/i.test(vid)) return new NextResponse(null, { status: 400 });

  const hints = (body.hints ?? {}) as Record<string, unknown>;
  const ua = clean(request.headers.get('user-agent'), 400) ?? '';
  const info = parseUserAgent(ua, {
    platform: clean(hints.platform, 30),
    platformVersion: clean(hints.platformVersion, 20),
    model: clean(hints.model, 60),
    mobile: hints.mobile === true,
    touch: typeof body.touch === 'number' ? body.touch : undefined,
  });
  const lat = parseFloat(request.headers.get('x-vercel-ip-latitude') ?? '');
  const lng = parseFloat(request.headers.get('x-vercel-ip-longitude') ?? '');
  const screen = clean(body.screen, 12);

  const entry: AccessEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    vid,
    ip: clientIp(request),
    city: header(request, 'x-vercel-ip-city'),
    region: header(request, 'x-vercel-ip-country-region'),
    country: header(request, 'x-vercel-ip-country'),
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    path,
    ref: clean(body.ref, 200),
    ...info,
    screen: screen && /^\d{2,5}×\d{2,5}$/.test(screen) ? screen : undefined,
    lang: clean(body.lang, 20),
    tz: clean(body.tz, 60),
    ua,
  };
  // Save after answering, so page views never wait on storage.
  after(() => recordAccess(entry).catch((err) => console.error('Access log write failed:', err)));
  return new NextResponse(null, { status: 204 });
}

function denied(check: ReturnType<typeof checkAdmin>) {
  return NextResponse.json({ error: check }, { status: check === 'not-configured' ? 503 : 401 });
}

const CSV_COLUMNS: [string, (e: AccessEntry) => string | number | undefined][] = [
  ['Time', (e) => e.at],
  ['Visitor', (e) => e.vid],
  ['IP address', (e) => e.ip],
  ['City', (e) => e.city],
  ['Region', (e) => e.region],
  ['Country', (e) => e.country],
  ['Latitude', (e) => e.lat],
  ['Longitude', (e) => e.lng],
  ['Device', (e) => e.device],
  ['OS', (e) => e.os],
  ['Browser', (e) => e.browser],
  ['Model', (e) => e.model],
  ['Screen', (e) => e.screen],
  ['Language', (e) => e.lang],
  ['Time zone', (e) => e.tz],
  ['Page', (e) => e.path],
  ['Referrer', (e) => e.ref],
  ['User agent', (e) => e.ua],
];

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  // Quote everything; neutralise spreadsheet formulas (but keep numbers like -122.08).
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Admin: the filtered log (JSON, or CSV with ?format=csv). */
export async function GET(request: NextRequest) {
  const check = checkAdmin(request);
  if (check !== 'ok') return denied(check);

  const p = request.nextUrl.searchParams;
  const filters: AccessFilters = {};
  for (const k of ['within', 'from', 'to', 'q', 'device', 'country', 'os', 'browser', 'page', 'vid', 'ip', 'excludeVid'] as const) {
    const v = p.get(k);
    if (v) filters[k] = v;
  }
  const all = await readAccess();

  if (p.get('format') === 'csv') {
    const { entries } = queryAccess(all, filters, 0, CAPACITY);
    const csv = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(','), ...entries.map((e) => CSV_COLUMNS.map(([, get]) => csvCell(get(e))).join(','))].join('\r\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kapilya-access-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const offset = Math.max(0, parseInt(p.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(CAPACITY, Math.max(1, parseInt(p.get('limit') ?? '100', 10) || 100));
  return NextResponse.json(
    { storage: ACCESS_STORAGE, capacity: CAPACITY, ...queryAccess(all, filters, offset, limit) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/** Admin: delete the whole log. */
export async function DELETE(request: NextRequest) {
  const check = checkAdmin(request);
  if (check !== 'ok') return denied(check);
  await clearAccess();
  return NextResponse.json({ ok: true });
}
