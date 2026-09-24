/**
 * Time formatting utility for Kapilya Directory
 * Formats worship service times to standard 12-hour format (e.g. 5:45 AM, 7:30 PM).
 */
export function formatTime12Hour(timeStr?: string): string {
  if (!timeStr) return '';
  // If already in 12h format (contains AM or PM), return as-is
  if (/am|pm/i.test(timeStr)) {
    return timeStr.trim();
  }

  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;

  let hour = parseInt(parts[0], 10);
  const minute = parts[1].slice(0, 2);
  if (isNaN(hour)) return timeStr;

  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${ampm}`;
}

/** Minutes since midnight for "19:30" or "7:30 PM" style times (for chronological sorting). */
export function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const isPM = /pm/i.test(timeStr);
  const isAM = /am/i.test(timeStr);
  const [hStr, mStr] = timeStr.replace(/(am|pm)/gi, '').trim().split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}
