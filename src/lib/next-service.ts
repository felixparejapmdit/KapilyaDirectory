import type { WorshipScheduleItem } from './types.ts';
import { timeToMinutes } from './time.ts';

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEK = 7 * 24 * 60;
/** A service that started less than this many minutes ago is still "in progress". */
export const ONGOING_WINDOW_MINUTES = 60;

/** Day of week and minutes since midnight on the wall clock of `timeZone`. */
export function zonedWallClock(timeZone: string | undefined, now: Date = new Date()): { day: number; minutes: number } {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(now)
        .map((p) => [p.type, p.value])
    );
    return { day: WEEKDAYS[parts.weekday] ?? now.getDay(), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  } catch {
    return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
  }
}

export interface NextServiceInfo {
  item: WorshipScheduleItem;
  /** Minutes until the service starts on the locale's clock (negative while in progress). */
  startsInMinutes: number;
}

/** The next (or in-progress) service of a locale, evaluated on the locale's own clock. */
export function findNextService(
  schedule: WorshipScheduleItem[] | undefined,
  timeZone: string | undefined,
  now: Date = new Date(),
  ongoingWindow: number = ONGOING_WINDOW_MINUTES
): NextServiceInfo | null {
  if (!schedule?.length) return null;
  const clock = zonedWallClock(timeZone, now);
  const nowMinutes = clock.day * 24 * 60 + clock.minutes;
  let best: NextServiceInfo | null = null;
  for (const item of schedule) {
    let diff = item.day_of_week * 24 * 60 + timeToMinutes(item.start_time) - nowMinutes;
    if (diff < -ongoingWindow) diff += WEEK;
    if (diff >= WEEK - ongoingWindow) diff -= WEEK;
    if (!best || diff < best.startsInMinutes) best = { item, startsInMinutes: diff };
  }
  return best;
}

export interface ReachableService extends NextServiceInfo {
  /** Minutes until you need to leave to arrive on time (0 = leave now). */
  leaveInMinutes: number;
  travelMinutes: number;
}

/**
 * The soonest service you can still make: leaving now and travelling `travelMinutes`, the first
 * service that starts after you arrive. ("Soonest" is what matters when choosing where to go now:
 * a closer chapel whose service already started is a worse choice than one a little farther away.)
 */
export function findReachableService(
  schedule: WorshipScheduleItem[] | undefined,
  timeZone: string | undefined,
  travelMinutes: number,
  now: Date = new Date()
): ReachableService | null {
  const arrival = new Date(now.getTime() + Math.max(0, travelMinutes) * 60_000);
  const next = findNextService(schedule, timeZone, arrival, 0);
  if (!next) return null;
  return {
    item: next.item,
    startsInMinutes: next.startsInMinutes + travelMinutes,
    leaveInMinutes: next.startsInMinutes,
    travelMinutes,
  };
}

/** Travel time to use when no road route is known: roughly 30 km/h door to door in towns. */
export const estimateTravelMinutes = (straightKm: number) => Math.round(straightKm * 2.2);

/** "leave now" / "leave in 25m" / "leave in 1h 10m". */
export function formatLeaveIn(minutes: number): string {
  if (minutes <= 2) return 'leave now';
  return `leave ${formatCountdown(minutes)}`;
}

/** "in 45m", "in 3h 10m", "in 1d 1h", or "in progress". */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'in progress';
  if (minutes < 60) return `in ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}
