import type { WorshipScheduleItem } from './types.ts';
import { timeToMinutes } from './time.ts';

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEK = 7 * 24 * 60;
/** A service without an end time counts as ongoing for this long after it starts. */
export const ONGOING_WINDOW_MINUTES = 60;
/** How the app words a service that has started and not yet ended. */
export const ONGOING_LABEL = 'Ongoing';

/**
 * How long a service counts as "ongoing" after it starts: until its end time when the source
 * lists one, otherwise ONGOING_WINDOW_MINUTES (one hour).
 */
export function serviceDurationMinutes(item: Pick<WorshipScheduleItem, 'start_time' | 'end_time'>): number {
  if (!item.end_time) return ONGOING_WINDOW_MINUTES;
  let d = timeToMinutes(item.end_time) - timeToMinutes(item.start_time);
  if (d <= 0) d += 24 * 60; // ends after midnight
  return Math.min(d, 6 * 60);
}

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

/** UTC offset of `timeZone` at `date`, in minutes (Manila = +480). */
export function tzOffsetMinutes(timeZone: string, date: Date = new Date()): number {
  try {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
        .formatToParts(date)
        .map((x) => [x.type, x.value])
    );
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/**
 * A weekly slot (day + "HH:MM") moved by `shift` minutes, e.g. a Los Angeles Saturday 6:00 PM
 * service seen in Philippine time (shift +900) is Sunday 9:00 AM.
 */
export function shiftSlot(day: number, startTime: string, shift: number): { day: number; minutes: number; time: string } {
  const week = 7 * 24 * 60;
  const m = (((day * 1440 + timeToMinutes(startTime) + shift) % week) + week) % week;
  const minutes = m % 1440;
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return { day: Math.floor(m / 1440), minutes, time };
}

export interface NextServiceInfo {
  item: WorshipScheduleItem;
  /** Minutes until the service starts on the locale's clock (0 or negative while ongoing). */
  startsInMinutes: number;
}

/** True once a service's start time is reached, until it ends (see serviceDurationMinutes). */
export const isOngoing = (next: NextServiceInfo | null | undefined): boolean => !!next && next.startsInMinutes <= 0;

/**
 * The next (or ongoing) service of a locale, evaluated on the locale's own clock. A service is
 * ongoing from its start time until it ends (its end time, or one hour). `ongoingWindow` overrides
 * that (0 = only services that haven't started, e.g. when you still need to get there).
 */
export function findNextService(
  schedule: WorshipScheduleItem[] | undefined,
  timeZone: string | undefined,
  now: Date = new Date(),
  ongoingWindow?: number
): NextServiceInfo | null {
  if (!schedule?.length) return null;
  const clock = zonedWallClock(timeZone, now);
  const nowMinutes = clock.day * 24 * 60 + clock.minutes;
  let best: NextServiceInfo | null = null;
  for (const item of schedule) {
    const window = ongoingWindow ?? serviceDurationMinutes(item);
    let diff = item.day_of_week * 24 * 60 + timeToMinutes(item.start_time) - nowMinutes;
    if (diff < -window) diff += WEEK;
    if (diff >= WEEK - window) diff -= WEEK;
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

/** "in 45m", "in 3h 10m", "in 1d 1h", or "ongoing". */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'ongoing';
  if (minutes < 60) return `in ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}
