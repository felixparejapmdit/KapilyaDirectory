'use client';

import React, { useEffect, useState } from 'react';
import { WorshipScheduleItem } from '@/lib/types';
import { Clock, Calendar } from 'lucide-react';
import { formatTime12Hour, timeToMinutes } from '@/lib/time';
import { findNextService, formatCountdown, ONGOING_LABEL } from '@/lib/next-service';

interface DepartureBoardProps {
  schedule?: WorshipScheduleItem[];
  timezone?: string;
}

export function DepartureBoard({ schedule = [], timezone = 'Local Time' }: DepartureBoardProps) {
  // Live status on the congregation's own clock, refreshed every 30 s.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  const tz = timezone === 'Local Time' ? undefined : timezone;
  const current = now ? findNextService(schedule, tz, now) : null;
  const ongoingId = current && current.startsInMinutes <= 0 ? current.item.id : null;
  const upcoming = now ? findNextService(schedule, tz, now, 0) : null;

  if (schedule.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-[#A9B4C2] glass-card">
        No worship schedule records posted for this locale. Please confirm directly with the district office.
      </div>
    );
  }

  // Group by day of week (Monday-first, matching the official directory)
  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const groupedByDay: Record<string, WorshipScheduleItem[]> = {};

  for (const item of schedule) {
    if (!groupedByDay[item.day_name]) {
      groupedByDay[item.day_name] = [];
    }
    groupedByDay[item.day_name].push(item);
  }

  // Sort within each day by start_time
  Object.keys(groupedByDay).forEach((day) => {
    groupedByDay[day].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  });

  const sortedDays = Object.keys(groupedByDay).sort(
    (a, b) => daysOrder.indexOf(a) - daysOrder.indexOf(b)
  );

  return (
    <div className="space-y-4">
      {/* Timezone Note */}
      <div className="flex items-center justify-between text-xs text-[#A9B4C2] px-1">
        <span className="flex items-center gap-1.5 font-medium">
          <Clock size={14} className="text-[#E8A33D]" />
          Times displayed in locale time zone ({timezone})
        </span>
        <span className="text-[11px] opacity-80">Departure Board Format</span>
      </div>

      {/* Days Table */}
      <div className="grid gap-3">
        {sortedDays.map((dayName) => {
          const items = groupedByDay[dayName];
          return (
            <div
              key={dayName}
              className="glass-card p-4 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              {/* Day Header */}
              <div className="flex items-center gap-2.5 min-w-[120px]">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#E8A33D]">
                  <Calendar size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base tracking-wide">{dayName}</h4>
                  <span className="text-[11px] text-[#A9B4C2]">
                    {items.length} {items.length === 1 ? 'service' : 'services'}
                  </span>
                </div>
              </div>

              {/* Times Chips */}
              <div className="flex flex-wrap gap-2.5 items-center">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`departure-chip bg-[#0B1426] border px-3 py-1.5 rounded-lg shadow-inner group flex flex-wrap items-center gap-2 ${
                      item.id === ongoingId
                        ? 'border-emerald-400/70 ring-1 ring-emerald-400/40'
                        : item.id === upcoming?.item.id
                          ? 'border-[#E8A33D]/70'
                          : 'border-white/20'
                    }`}
                  >
                    {/* Live status: ongoing from its start time for one hour (or until its end time) */}
                    {item.id === ongoingId && (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        {ONGOING_LABEL}
                      </span>
                    )}
                    {item.id !== ongoingId && item.id === upcoming?.item.id && (
                      <span className="rounded bg-[#E8A33D]/15 px-1.5 py-0.5 font-departure text-[10px] font-bold text-[#E8A33D]">
                        NEXT · {formatCountdown(upcoming.startsInMinutes)}
                      </span>
                    )}
                    {/* Time Digits */}
                    <span className="text-base text-white font-departure tracking-tight">
                      {formatTime12Hour(item.start_time)}
                    </span>

                    {/* Language Badge (some source entries list no language) */}
                    {item.language !== 'Unspecified' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-[#5AA9FF] uppercase tracking-wider">
                        {item.language}
                      </span>
                    )}

                    {/* Secondary Language */}
                    {item.language2 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-emerald-400 uppercase tracking-wider">
                        {item.language2}
                      </span>
                    )}

                    {/* CWS Tag */}
                    {item.is_cws && (
                      <span className="badge-cws text-[10px] font-bold uppercase tracking-wider">
                        CWS
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
