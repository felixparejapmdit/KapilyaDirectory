export type WorldArea =
  | 'americas'
  | 'asia'
  | 'europe'
  | 'australia_oceania'
  | 'africa'
  | 'philippines';

export type LocaleKind =
  | 'local_congregation'
  | 'extension'
  | 'group_worship_service';

export interface Region {
  id: string;
  name: string;
  slug: string;
  world_area: WorldArea;
  sort_order: number;
}

export interface District {
  id: string;
  region_id: string;
  name: string;
  slug: string;
  timezone: string; // IANA e.g. "Asia/Manila", "America/Anchorage"
  source_updated_at: string;
  locale_count?: number;
}

export interface WorshipScheduleItem {
  id: string;
  locale_id: string;
  service_type: string; // e.g. "Worship", "CWS", "Bible Study"
  day_of_week: number; // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  day_name: string; // e.g. "Thursday", "Sunday"
  start_time: string; // e.g. "06:00", "19:30"
  end_time?: string | null;
  language: string; // e.g. "English", "Tagalog"
  language2?: string;
  is_cws?: boolean;
}

export interface Locale {
  id: string;
  district_id: string;
  district_name?: string;
  district_slug?: string;
  timezone?: string;
  name: string;
  slug: string;
  kind: LocaleKind;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  email?: string | null;
  languages: string[];
  source_updated_at: string;
  schedule?: WorshipScheduleItem[];
  distance_km?: number;
}

export interface DataSnapshot {
  id: string;
  created_at: string;
  storage_url: string;
  record_counts: {
    regions: number;
    districts: number;
    locales: number;
    extensions: number;
    group_worship_services: number;
    schedules: number;
  };
  status: 'success' | 'failed' | 'rolled_back';
  description?: string;
}

export interface DirectoryTotals {
  regions: number;
  districts: number;
  locales: number;
  extensions: number;
  group_worship_services: number;
  last_updated: string;
  last_snapshot_id: string;
}

export interface NextServiceStatus {
  locale: Locale;
  scheduleItem: WorshipScheduleItem;
  startsInMinutes: number;
  statusText: string;
  isImminent: boolean;
  /** Minutes until the user should leave to arrive on time (travel-aware soonest service). */
  leaveInMinutes?: number;
  /** Road distance and drive time, e.g. "3.2 km · 7 min". */
  travelText?: string;
}
