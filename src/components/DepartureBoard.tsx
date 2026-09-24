'use client';

import React from 'react';
import { WorshipScheduleItem } from '@/lib/types';
import { Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { formatTime12Hour, timeToMinutes } from '@/lib/time';

interface DepartureBoardProps {
  schedule?: WorshipScheduleItem[];
  timezone?: string;
}

export function DepartureBoard({ schedule = [], timezone = 'Local Time' }: DepartureBoardProps) {
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
                    className="departure-chip bg-[#0B1426] border border-white/20 px-3 py-1.5 rounded-lg shadow-inner group flex items-center gap-2"
                  >
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
