import { Region, District, Locale, WorshipScheduleItem, DataSnapshot } from './types';

export const INITIAL_REGIONS: Region[] = [
  {
    "id": "reg-americas",
    "name": "Americas",
    "slug": "americas",
    "world_area": "americas",
    "sort_order": 1
  },
  {
    "id": "reg-asia",
    "name": "Asia",
    "slug": "asia",
    "world_area": "asia",
    "sort_order": 2
  },
  {
    "id": "reg-europe",
    "name": "Europe",
    "slug": "europe",
    "world_area": "europe",
    "sort_order": 3
  },
  {
    "id": "reg-australia-oceania",
    "name": "Australia & Oceania",
    "slug": "australia-oceania",
    "world_area": "australia_oceania",
    "sort_order": 4
  },
  {
    "id": "reg-africa",
    "name": "Africa",
    "slug": "africa",
    "world_area": "africa",
    "sort_order": 5
  },
  {
    "id": "reg-autonomous-region-in-muslim-mindanao",
    "name": "Autonomous Region In Muslim Mindanao",
    "slug": "autonomous-region-in-muslim-mindanao",
    "world_area": "philippines",
    "sort_order": 6
  },
  {
    "id": "reg-bicol-region",
    "name": "Bicol Region",
    "slug": "bicol-region",
    "world_area": "philippines",
    "sort_order": 7
  },
  {
    "id": "reg-cagayan-valley",
    "name": "Cagayan Valley",
    "slug": "cagayan-valley",
    "world_area": "philippines",
    "sort_order": 8
  },
  {
    "id": "reg-caraga",
    "name": "Caraga",
    "slug": "caraga",
    "world_area": "philippines",
    "sort_order": 9
  },
  {
    "id": "reg-central-luzon",
    "name": "Central Luzon",
    "slug": "central-luzon",
    "world_area": "philippines",
    "sort_order": 10
  },
  {
    "id": "reg-central-mindanao",
    "name": "Central Mindanao",
    "slug": "central-mindanao",
    "world_area": "philippines",
    "sort_order": 11
  },
  {
    "id": "reg-central-visayas",
    "name": "Central Visayas",
    "slug": "central-visayas",
    "world_area": "philippines",
    "sort_order": 12
  },
  {
    "id": "reg-cordillera-administrative-region",
    "name": "Cordillera Administrative Region",
    "slug": "cordillera-administrative-region",
    "world_area": "philippines",
    "sort_order": 13
  },
  {
    "id": "reg-eastern-visayas",
    "name": "Eastern Visayas",
    "slug": "eastern-visayas",
    "world_area": "philippines",
    "sort_order": 14
  },
  {
    "id": "reg-ilocos-region",
    "name": "Ilocos Region",
    "slug": "ilocos-region",
    "world_area": "philippines",
    "sort_order": 15
  },
  {
    "id": "reg-national-capital-region",
    "name": "National Capital Region",
    "slug": "national-capital-region",
    "world_area": "philippines",
    "sort_order": 16
  },
  {
    "id": "reg-northern-mindanao",
    "name": "Northern Mindanao",
    "slug": "northern-mindanao",
    "world_area": "philippines",
    "sort_order": 17
  },
  {
    "id": "reg-southern-mindanao",
    "name": "Southern Mindanao",
    "slug": "southern-mindanao",
    "world_area": "philippines",
    "sort_order": 18
  },
  {
    "id": "reg-southern-tagalog",
    "name": "Southern Tagalog",
    "slug": "southern-tagalog",
    "world_area": "philippines",
    "sort_order": 19
  },
  {
    "id": "reg-western-mindanao",
    "name": "Western Mindanao",
    "slug": "western-mindanao",
    "world_area": "philippines",
    "sort_order": 20
  },
  {
    "id": "reg-western-visayas",
    "name": "Western Visayas",
    "slug": "western-visayas",
    "world_area": "philippines",
    "sort_order": 21
  }
];

export const INITIAL_DISTRICTS: District[] = [
  {
    "id": "dist-alaska",
    "region_id": "reg-americas",
    "name": "Alaska",
    "slug": "alaska",
    "timezone": "America/Anchorage",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northwest-california",
    "region_id": "reg-americas",
    "name": "Bay Area California",
    "slug": "northwest-california",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-western-canada",
    "region_id": "reg-americas",
    "name": "British Columbia",
    "slug": "western-canada",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-canada-v",
    "region_id": "reg-americas",
    "name": "Calgary",
    "slug": "canada-v",
    "timezone": "America/Denver",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-latin-america",
    "region_id": "reg-americas",
    "name": "Central America",
    "slug": "latin-america",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-central-valley-california",
    "region_id": "reg-americas",
    "name": "Central Valley, California",
    "slug": "central-valley-california",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-eastern-ontario",
    "region_id": "reg-americas",
    "name": "Eastern Ontario",
    "slug": "eastern-ontario",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-canada-vi",
    "region_id": "reg-americas",
    "name": "Edmonton",
    "slug": "canada-vi",
    "timezone": "America/Denver",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-caribbean",
    "region_id": "reg-americas",
    "name": "Florida & Caribbean",
    "slug": "caribbean",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northern-midwest",
    "region_id": "reg-americas",
    "name": "Great Lakes",
    "slug": "northern-midwest",
    "timezone": "America/Chicago",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-eastern-canada",
    "region_id": "reg-americas",
    "name": "Greater Toronto",
    "slug": "eastern-canada",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-hawaii-pacific",
    "region_id": "reg-americas",
    "name": "Hawaii Pacific",
    "slug": "hawaii-pacific",
    "timezone": "Pacific/Honolulu",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-los-angeles-county",
    "region_id": "reg-americas",
    "name": "Los Angeles County",
    "slug": "los-angeles-county",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-central-canada",
    "region_id": "reg-americas",
    "name": "Manitoba",
    "slug": "central-canada",
    "timezone": "America/Chicago",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-marianas-islands",
    "region_id": "reg-americas",
    "name": "Micronesia",
    "slug": "marianas-islands",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mountain-states",
    "region_id": "reg-americas",
    "name": "Mountain States",
    "slug": "mountain-states",
    "timezone": "America/Denver",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-new-jersey",
    "region_id": "reg-americas",
    "name": "New Jersey",
    "slug": "new-jersey",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northeastern-seaboard",
    "region_id": "reg-americas",
    "name": "New York",
    "slug": "northeastern-seaboard",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northeast-california",
    "region_id": "reg-americas",
    "name": "Northeast California",
    "slug": "northeast-california",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northern-plains",
    "region_id": "reg-americas",
    "name": "Northern Plains",
    "slug": "northern-plains",
    "timezone": "America/Chicago",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southwest-california",
    "region_id": "reg-americas",
    "name": "Orange County",
    "slug": "southwest-california",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-oregon",
    "region_id": "reg-americas",
    "name": "Oregon",
    "slug": "oregon",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-canada-vii",
    "region_id": "reg-americas",
    "name": "Quebec and Atlantic Canada",
    "slug": "canada-vii",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southeast-california",
    "region_id": "reg-americas",
    "name": "San Diego County, California",
    "slug": "southeast-california",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-saskatchewan",
    "region_id": "reg-americas",
    "name": "Saskatchewan",
    "slug": "saskatchewan",
    "timezone": "America/Chicago",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-silicon-valley-california",
    "region_id": "reg-americas",
    "name": "Silicon Valley, California",
    "slug": "silicon-valley-california",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-brazil",
    "region_id": "reg-americas",
    "name": "South America",
    "slug": "brazil",
    "timezone": "America/Sao_Paulo",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-south-central-states",
    "region_id": "reg-americas",
    "name": "South Central States",
    "slug": "south-central-states",
    "timezone": "America/Chicago",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southeastern-seaboard",
    "region_id": "reg-americas",
    "name": "Southeast USA",
    "slug": "southeastern-seaboard",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-canada-iv",
    "region_id": "reg-americas",
    "name": "Southern Ontario",
    "slug": "canada-iv",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southern-midwest",
    "region_id": "reg-americas",
    "name": "Texas",
    "slug": "southern-midwest",
    "timezone": "America/Chicago",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mid-atlantic-ii",
    "region_id": "reg-americas",
    "name": "Virginia and the Carolinas",
    "slug": "mid-atlantic-ii",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mid-atlantic",
    "region_id": "reg-americas",
    "name": "Washington DC",
    "slug": "mid-atlantic",
    "timezone": "America/New_York",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pacific-northwest",
    "region_id": "reg-americas",
    "name": "Washington State",
    "slug": "pacific-northwest",
    "timezone": "America/Los_Angeles",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-china",
    "region_id": "reg-asia",
    "name": "Hongkong",
    "slug": "china",
    "timezone": "Asia/Hong_Kong",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-macau",
    "region_id": "reg-asia",
    "name": "Macau",
    "slug": "macau",
    "timezone": "Asia/Macau",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southeast-asia-ii",
    "region_id": "reg-asia",
    "name": "Malaysia",
    "slug": "southeast-asia-ii",
    "timezone": "Asia/Kuala_Lumpur",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-japan-ii",
    "region_id": "reg-asia",
    "name": "Nagoya, Japan",
    "slug": "japan-ii",
    "timezone": "Asia/Tokyo",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southeast-asia-iii",
    "region_id": "reg-asia",
    "name": "Sabah",
    "slug": "southeast-asia-iii",
    "timezone": "Asia/Kuala_Lumpur",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-south-korea",
    "region_id": "reg-asia",
    "name": "South Korea",
    "slug": "south-korea",
    "timezone": "Asia/Seoul",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-taiwan",
    "region_id": "reg-asia",
    "name": "Taiwan",
    "slug": "taiwan",
    "timezone": "Asia/Taipei",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-taiwan-south",
    "region_id": "reg-asia",
    "name": "Taiwan South",
    "slug": "taiwan-south",
    "timezone": "Asia/Taipei",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southeast-asia-i",
    "region_id": "reg-asia",
    "name": "Thailand",
    "slug": "southeast-asia-i",
    "timezone": "Asia/Bangkok",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-japan",
    "region_id": "reg-asia",
    "name": "Tokyo, Japan",
    "slug": "japan",
    "timezone": "Asia/Tokyo",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-britain-north",
    "region_id": "reg-europe",
    "name": "Britain North",
    "slug": "britain-north",
    "timezone": "Europe/London",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-united-kingdom",
    "region_id": "reg-europe",
    "name": "Britain South",
    "slug": "united-kingdom",
    "timezone": "Europe/London",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-central-europe",
    "region_id": "reg-europe",
    "name": "Central Europe",
    "slug": "central-europe",
    "timezone": "Europe/Paris",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-ireland",
    "region_id": "reg-europe",
    "name": "Ireland",
    "slug": "ireland",
    "timezone": "Europe/London",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-milan",
    "region_id": "reg-europe",
    "name": "Italy North",
    "slug": "milan",
    "timezone": "Europe/Rome",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southern-europe",
    "region_id": "reg-europe",
    "name": "Italy South",
    "slug": "southern-europe",
    "timezone": "Europe/Rome",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mediterranean",
    "region_id": "reg-europe",
    "name": "Mediterranean",
    "slug": "mediterranean",
    "timezone": "Europe/Paris",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northern-europe",
    "region_id": "reg-europe",
    "name": "Northern Europe",
    "slug": "northern-europe",
    "timezone": "Europe/Paris",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-spain",
    "region_id": "reg-europe",
    "name": "Spain",
    "slug": "spain",
    "timezone": "Europe/Madrid",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-western-europe",
    "region_id": "reg-europe",
    "name": "Western Europe",
    "slug": "western-europe",
    "timezone": "Europe/Paris",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-australia-east",
    "region_id": "reg-australia-oceania",
    "name": "New South Wales, Australia",
    "slug": "australia-east",
    "timezone": "Australia/Sydney",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-new-zealand",
    "region_id": "reg-australia-oceania",
    "name": "New Zealand North",
    "slug": "new-zealand",
    "timezone": "Pacific/Auckland",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-new-zealand-south",
    "region_id": "reg-australia-oceania",
    "name": "New Zealand South",
    "slug": "new-zealand-south",
    "timezone": "Pacific/Auckland",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-queensland-australia",
    "region_id": "reg-australia-oceania",
    "name": "Queensland, Australia",
    "slug": "queensland-australia",
    "timezone": "Australia/Brisbane",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-australia-west",
    "region_id": "reg-australia-oceania",
    "name": "Victoria, Australia",
    "slug": "australia-west",
    "timezone": "Australia/Melbourne",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-western-australia-1",
    "region_id": "reg-australia-oceania",
    "name": "Western Australia",
    "slug": "western-australia-1",
    "timezone": "Australia/Perth",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northern-africa",
    "region_id": "reg-africa",
    "name": "Northern Africa",
    "slug": "northern-africa",
    "timezone": "Africa/Cairo",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southeastern-africa",
    "region_id": "reg-africa",
    "name": "Southeastern Africa",
    "slug": "southeastern-africa",
    "timezone": "Africa/Johannesburg",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-africa",
    "region_id": "reg-africa",
    "name": "Southern Africa",
    "slug": "africa",
    "timezone": "Africa/Johannesburg",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-don-carlos-bukidnon",
    "region_id": "reg-autonomous-region-in-muslim-mindanao",
    "name": "Don Carlos, Bukidnon",
    "slug": "don-carlos-bukidnon",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-lanao",
    "region_id": "reg-autonomous-region-in-muslim-mindanao",
    "name": "Lanao",
    "slug": "lanao",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-maguindanao",
    "region_id": "reg-autonomous-region-in-muslim-mindanao",
    "name": "Maguindanao",
    "slug": "maguindanao",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bukidnon",
    "region_id": "reg-autonomous-region-in-muslim-mindanao",
    "name": "Valencia City, Bukidnon",
    "slug": "bukidnon",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-zamboanga-central",
    "region_id": "reg-autonomous-region-in-muslim-mindanao",
    "name": "Zamboanga City",
    "slug": "zamboanga-central",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-albay",
    "region_id": "reg-bicol-region",
    "name": "Albay",
    "slug": "albay",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-camarines-norte",
    "region_id": "reg-bicol-region",
    "name": "Camarines Norte",
    "slug": "camarines-norte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-catanduanes",
    "region_id": "reg-bicol-region",
    "name": "Catanduanes",
    "slug": "catanduanes",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-camarines-southeast",
    "region_id": "reg-bicol-region",
    "name": "Iriga City, Camarines Sur",
    "slug": "camarines-southeast",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-masbate",
    "region_id": "reg-bicol-region",
    "name": "Masbate",
    "slug": "masbate",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-camarines-southwest",
    "region_id": "reg-bicol-region",
    "name": "Naga City, Camarines Sur",
    "slug": "camarines-southwest",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-sorsogon",
    "region_id": "reg-bicol-region",
    "name": "Sorsogon",
    "slug": "sorsogon",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cagayan-east",
    "region_id": "reg-cagayan-valley",
    "name": "Cagayan East",
    "slug": "cagayan-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cagayan-south",
    "region_id": "reg-cagayan-valley",
    "name": "Cagayan South",
    "slug": "cagayan-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cagayan-west",
    "region_id": "reg-cagayan-valley",
    "name": "Cagayan West",
    "slug": "cagayan-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-isabela-east",
    "region_id": "reg-cagayan-valley",
    "name": "Isabela East",
    "slug": "isabela-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-isabela-south",
    "region_id": "reg-cagayan-valley",
    "name": "Isabela South",
    "slug": "isabela-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-isabela-west",
    "region_id": "reg-cagayan-valley",
    "name": "Isabela West",
    "slug": "isabela-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-nueva-vizcaya",
    "region_id": "reg-cagayan-valley",
    "name": "Nueva Vizcaya",
    "slug": "nueva-vizcaya",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-quirino",
    "region_id": "reg-cagayan-valley",
    "name": "Quirino",
    "slug": "quirino",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-agusan-del-norte",
    "region_id": "reg-caraga",
    "name": "Agusan Del Norte",
    "slug": "agusan-del-norte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-agusan-del-sur",
    "region_id": "reg-caraga",
    "name": "Agusan Del Sur",
    "slug": "agusan-del-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-surigao-del-sur",
    "region_id": "reg-caraga",
    "name": "Bislig City, Surigao Del Sur",
    "slug": "surigao-del-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-surigao-del-norte",
    "region_id": "reg-caraga",
    "name": "Surigao Del Norte",
    "slug": "surigao-del-norte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-surigao-central",
    "region_id": "reg-caraga",
    "name": "Tandag City, Surigao Del Sur",
    "slug": "surigao-central",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-aurora",
    "region_id": "reg-central-luzon",
    "name": "Aurora",
    "slug": "aurora",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bataan",
    "region_id": "reg-central-luzon",
    "name": "Bataan",
    "slug": "bataan",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bataan-south",
    "region_id": "reg-central-luzon",
    "name": "Bataan South",
    "slug": "bataan-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bulacan-north",
    "region_id": "reg-central-luzon",
    "name": "Bulacan",
    "slug": "bulacan-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bulacan-east",
    "region_id": "reg-central-luzon",
    "name": "Bulacan East",
    "slug": "bulacan-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bulacan-north-1",
    "region_id": "reg-central-luzon",
    "name": "Bulacan North",
    "slug": "bulacan-north-1",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bulacan-south",
    "region_id": "reg-central-luzon",
    "name": "Bulacan South",
    "slug": "bulacan-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bulacan-west",
    "region_id": "reg-central-luzon",
    "name": "Bulacan West",
    "slug": "bulacan-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-nueva-ecija-central",
    "region_id": "reg-central-luzon",
    "name": "Cabanatuan City, Nueva Ecija",
    "slug": "nueva-ecija-central",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-tarlac",
    "region_id": "reg-central-luzon",
    "name": "Capas, Tarlac",
    "slug": "tarlac",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-guimba",
    "region_id": "reg-central-luzon",
    "name": "Guimba, Nueva Ecija",
    "slug": "guimba",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-nueva-ecija-east",
    "region_id": "reg-central-luzon",
    "name": "Palayan City, Nueva Ecija",
    "slug": "nueva-ecija-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pampanga-east",
    "region_id": "reg-central-luzon",
    "name": "Pampanga East",
    "slug": "pampanga-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pampanga-north",
    "region_id": "reg-central-luzon",
    "name": "Pampanga North",
    "slug": "pampanga-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pampanga-west",
    "region_id": "reg-central-luzon",
    "name": "Pampanga West",
    "slug": "pampanga-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-tarlac-north",
    "region_id": "reg-central-luzon",
    "name": "Paniqui, Tarlac",
    "slug": "tarlac-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-nueva-ecija-north",
    "region_id": "reg-central-luzon",
    "name": "San Jose City, Nueva Ecija",
    "slug": "nueva-ecija-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-nueva-ecija-south",
    "region_id": "reg-central-luzon",
    "name": "Sta. Rosa, Nueva Ecija",
    "slug": "nueva-ecija-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-tarlac-central",
    "region_id": "reg-central-luzon",
    "name": "Tarlac City, Tarlac",
    "slug": "tarlac-central",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-zambales-north",
    "region_id": "reg-central-luzon",
    "name": "Zambales North",
    "slug": "zambales-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-zambales-south",
    "region_id": "reg-central-luzon",
    "name": "Zambales South",
    "slug": "zambales-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cotabato-north",
    "region_id": "reg-central-mindanao",
    "name": "Cotabato North",
    "slug": "cotabato-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cotabato-south",
    "region_id": "reg-central-mindanao",
    "name": "General Santos City, South Cotabato",
    "slug": "cotabato-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cotabato-southeast",
    "region_id": "reg-central-mindanao",
    "name": "Koronadal City, South Cotabato",
    "slug": "cotabato-southeast",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-sarangani",
    "region_id": "reg-central-mindanao",
    "name": "Sarangani",
    "slug": "sarangani",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-sultan-kudarat",
    "region_id": "reg-central-mindanao",
    "name": "Sultan Kudarat",
    "slug": "sultan-kudarat",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cebu-north",
    "region_id": "reg-central-visayas",
    "name": "Bogo City, Cebu",
    "slug": "cebu-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-bohol",
    "region_id": "reg-central-visayas",
    "name": "Bohol",
    "slug": "bohol",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cebu-iii",
    "region_id": "reg-central-visayas",
    "name": "Carcar City, Cebu",
    "slug": "cebu-iii",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cebu-south",
    "region_id": "reg-central-visayas",
    "name": "Cebu City, Cebu",
    "slug": "cebu-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-negros-oriental",
    "region_id": "reg-central-visayas",
    "name": "Negros Oriental",
    "slug": "negros-oriental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-negros-del-norte",
    "region_id": "reg-central-visayas",
    "name": "San Carlos, Negros Occidental",
    "slug": "negros-del-norte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-abra",
    "region_id": "reg-cordillera-administrative-region",
    "name": "Abra",
    "slug": "abra",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-benguet",
    "region_id": "reg-cordillera-administrative-region",
    "name": "Benguet",
    "slug": "benguet",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-kalinga",
    "region_id": "reg-cordillera-administrative-region",
    "name": "Kalinga",
    "slug": "kalinga",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mountain-province",
    "region_id": "reg-cordillera-administrative-region",
    "name": "Mountain Province",
    "slug": "mountain-province",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-eastern-samar",
    "region_id": "reg-eastern-visayas",
    "name": "Eastern Samar",
    "slug": "eastern-samar",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-leyte-west",
    "region_id": "reg-eastern-visayas",
    "name": "Leyte",
    "slug": "leyte-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-northern-samar",
    "region_id": "reg-eastern-visayas",
    "name": "Northern Samar",
    "slug": "northern-samar",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-southern-leyte",
    "region_id": "reg-eastern-visayas",
    "name": "Southern Leyte",
    "slug": "southern-leyte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-leyte-east",
    "region_id": "reg-eastern-visayas",
    "name": "Tacloban City, Leyte",
    "slug": "leyte-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-western-samar",
    "region_id": "reg-eastern-visayas",
    "name": "Western Samar",
    "slug": "western-samar",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-agoo-la-union",
    "region_id": "reg-ilocos-region",
    "name": "Agoo, La Union",
    "slug": "agoo-la-union",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pangasinan-west",
    "region_id": "reg-ilocos-region",
    "name": "Alaminos City, Pangasinan",
    "slug": "pangasinan-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-ilocos-norte-ii",
    "region_id": "reg-ilocos-region",
    "name": "Batac City, Ilocos Norte",
    "slug": "ilocos-norte-ii",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-candon-city-ilocos-sur",
    "region_id": "reg-ilocos-region",
    "name": "Candon City, Ilocos Sur",
    "slug": "candon-city-ilocos-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-ilocos-sur",
    "region_id": "reg-ilocos-region",
    "name": "Ilocos Sur",
    "slug": "ilocos-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-la-union",
    "region_id": "reg-ilocos-region",
    "name": "La Union",
    "slug": "la-union",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-ilocos-norte",
    "region_id": "reg-ilocos-region",
    "name": "Laoag City",
    "slug": "ilocos-norte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pangasinan-central",
    "region_id": "reg-ilocos-region",
    "name": "Lingayen, Pangasinan",
    "slug": "pangasinan-central",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pangasinan-southeast",
    "region_id": "reg-ilocos-region",
    "name": "Rosales, Pangasinan",
    "slug": "pangasinan-southeast",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-san-carlos-city-pangasinan",
    "region_id": "reg-ilocos-region",
    "name": "San Carlos City, Pangasinan",
    "slug": "san-carlos-city-pangasinan",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-pangasinan-east",
    "region_id": "reg-ilocos-region",
    "name": "Urdaneta City, Pangasinan",
    "slug": "pangasinan-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-caloocan-north",
    "region_id": "reg-national-capital-region",
    "name": "Caloocan North",
    "slug": "caloocan-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-metro-manila-north",
    "region_id": "reg-national-capital-region",
    "name": "Camanava",
    "slug": "metro-manila-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-central",
    "region_id": "reg-national-capital-region",
    "name": "CENTRAL",
    "slug": "central",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-makati",
    "region_id": "reg-national-capital-region",
    "name": "Makati",
    "slug": "makati",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-marikina",
    "region_id": "reg-national-capital-region",
    "name": "Marikina",
    "slug": "marikina",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-maynila",
    "region_id": "reg-national-capital-region",
    "name": "MAYNILA",
    "slug": "maynila",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-metro-manila-east",
    "region_id": "reg-national-capital-region",
    "name": "Metro Manila East",
    "slug": "metro-manila-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-metro-manila-south",
    "region_id": "reg-national-capital-region",
    "name": "Metro Manila South",
    "slug": "metro-manila-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-quezon-city",
    "region_id": "reg-national-capital-region",
    "name": "Quezon City",
    "slug": "quezon-city",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-rodriguez",
    "region_id": "reg-national-capital-region",
    "name": "Rodriguez",
    "slug": "rodriguez",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-misamis-oriental",
    "region_id": "reg-northern-mindanao",
    "name": "Cagayan De Oro City, Misamis Oriental",
    "slug": "misamis-oriental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-gingoog-city-misamis-oriental",
    "region_id": "reg-northern-mindanao",
    "name": "Gingoog City, Misamis Oriental",
    "slug": "gingoog-city-misamis-oriental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-misamis-occidental",
    "region_id": "reg-northern-mindanao",
    "name": "Misamis Occidental",
    "slug": "misamis-occidental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-buug-zamboanga-del-sur",
    "region_id": "reg-southern-mindanao",
    "name": "Buug, Zamboanga Del Sur",
    "slug": "buug-zamboanga-del-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-davao-west",
    "region_id": "reg-southern-mindanao",
    "name": "Davao City",
    "slug": "davao-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-compostela-valley",
    "region_id": "reg-southern-mindanao",
    "name": "Davao De Oro",
    "slug": "compostela-valley",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-davao-del-norte",
    "region_id": "reg-southern-mindanao",
    "name": "Davao Del Norte",
    "slug": "davao-del-norte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-davao-del-sur",
    "region_id": "reg-southern-mindanao",
    "name": "Davao Del Sur",
    "slug": "davao-del-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-davao-occidental-1",
    "region_id": "reg-southern-mindanao",
    "name": "Davao Occidental",
    "slug": "davao-occidental-1",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-davao-oriental",
    "region_id": "reg-southern-mindanao",
    "name": "Davao Oriental",
    "slug": "davao-oriental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-batangas",
    "region_id": "reg-southern-tagalog",
    "name": "Batangas",
    "slug": "batangas",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-batangas-north",
    "region_id": "reg-southern-tagalog",
    "name": "Batangas North",
    "slug": "batangas-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mindoro-oriental-south",
    "region_id": "reg-southern-tagalog",
    "name": "Bongabong, Oriental Mindoro",
    "slug": "mindoro-oriental-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-laguna-west",
    "region_id": "reg-southern-tagalog",
    "name": "Calamba City, Laguna",
    "slug": "laguna-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-calamian",
    "region_id": "reg-southern-tagalog",
    "name": "Calamian",
    "slug": "calamian",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cavite",
    "region_id": "reg-southern-tagalog",
    "name": "Cavite",
    "slug": "cavite",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-cavite-south",
    "region_id": "reg-southern-tagalog",
    "name": "Dasmarinas City, Cavite",
    "slug": "cavite-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mamburao-occidental-mindoro",
    "region_id": "reg-southern-tagalog",
    "name": "Mamburao, Mindoro Occidental",
    "slug": "mamburao-occidental-mindoro",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-marinduque",
    "region_id": "reg-southern-tagalog",
    "name": "Marinduque",
    "slug": "marinduque",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mindoro-oriental-north",
    "region_id": "reg-southern-tagalog",
    "name": "Mindoro Oriental",
    "slug": "mindoro-oriental-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-palawan",
    "region_id": "reg-southern-tagalog",
    "name": "Palawan",
    "slug": "palawan",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-palawan-north",
    "region_id": "reg-southern-tagalog",
    "name": "Palawan North",
    "slug": "palawan-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-palawan-south",
    "region_id": "reg-southern-tagalog",
    "name": "Palawan South",
    "slug": "palawan-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-quezon-west",
    "region_id": "reg-southern-tagalog",
    "name": "Quezon",
    "slug": "quezon-west",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-quezon-east",
    "region_id": "reg-southern-tagalog",
    "name": "Quezon East",
    "slug": "quezon-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-quezon-north",
    "region_id": "reg-southern-tagalog",
    "name": "Quezon North",
    "slug": "quezon-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-quezon-south",
    "region_id": "reg-southern-tagalog",
    "name": "Quezon South",
    "slug": "quezon-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-quezon-west-1",
    "region_id": "reg-southern-tagalog",
    "name": "Quezon West",
    "slug": "quezon-west-1",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-rizal",
    "region_id": "reg-southern-tagalog",
    "name": "Rizal",
    "slug": "rizal",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-rizal-east",
    "region_id": "reg-southern-tagalog",
    "name": "Rizal East",
    "slug": "rizal-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-romblon",
    "region_id": "reg-southern-tagalog",
    "name": "Romblon",
    "slug": "romblon",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-mindoro-occidental",
    "region_id": "reg-southern-tagalog",
    "name": "San Jose, Mindoro Occidental",
    "slug": "mindoro-occidental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-laguna-south",
    "region_id": "reg-southern-tagalog",
    "name": "San Pablo City, Laguna",
    "slug": "laguna-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-laguna-east",
    "region_id": "reg-southern-tagalog",
    "name": "Sta. Cruz, Laguna",
    "slug": "laguna-east",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-sta-rosa-city-laguna",
    "region_id": "reg-southern-tagalog",
    "name": "Sta. Rosa City, Laguna",
    "slug": "sta-rosa-city-laguna",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-trece-martires-city-cavite",
    "region_id": "reg-southern-tagalog",
    "name": "Trece Martires City, Cavite",
    "slug": "trece-martires-city-cavite",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-zamboanga-del-sur",
    "region_id": "reg-western-mindanao",
    "name": "Pagadian City, Zamboanga Del Sur",
    "slug": "zamboanga-del-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-zamboanga-del-norte",
    "region_id": "reg-western-mindanao",
    "name": "Zamboanga Del Norte",
    "slug": "zamboanga-del-norte",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-zamboanga-sibugay",
    "region_id": "reg-western-mindanao",
    "name": "Zamboanga Sibugay",
    "slug": "zamboanga-sibugay",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-aklan",
    "region_id": "reg-western-visayas",
    "name": "Aklan",
    "slug": "aklan",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-antique",
    "region_id": "reg-western-visayas",
    "name": "Antique",
    "slug": "antique",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-negros-occidental",
    "region_id": "reg-western-visayas",
    "name": "Bacolod City, Negros Occidental",
    "slug": "negros-occidental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-capiz",
    "region_id": "reg-western-visayas",
    "name": "Capiz",
    "slug": "capiz",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-iloilo-north",
    "region_id": "reg-western-visayas",
    "name": "Iloilo North",
    "slug": "iloilo-north",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-iloilo-south",
    "region_id": "reg-western-visayas",
    "name": "Iloilo South",
    "slug": "iloilo-south",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-negros-del-sur",
    "region_id": "reg-western-visayas",
    "name": "Kabankalan City, Negros Occidental",
    "slug": "negros-del-sur",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  },
  {
    "id": "dist-valladolid-negros-occidental",
    "region_id": "reg-western-visayas",
    "name": "Valladolid, Negros Occidental",
    "slug": "valladolid-negros-occidental",
    "timezone": "Asia/Manila",
    "source_updated_at": "2026-09-24T00:00:00Z"
  }
];

export const INITIAL_LOCALES: Locale[] = [
  // Alaska
  {
    id: 'loc-anchorage',
    district_id: 'dist-alaska',
    name: 'Anchorage',
    slug: 'anchorage',
    kind: 'local_congregation',
    address: '1441 Bragaw St., Anchorage, AK 99508, United States',
    latitude: 61.20791,
    longitude: -149.80756,
    phone: '907-947-0127',
    email: 'acastillo176@gmail.com',
    languages: ['English', 'Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-anc-1', locale_id: 'loc-anchorage', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '06:00', language: 'English', is_cws: false },
      { id: 'sch-anc-2', locale_id: 'loc-anchorage', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-anc-3', locale_id: 'loc-anchorage', service_type: 'Worship', day_of_week: 6, day_name: 'Saturday', start_time: '19:00', language: 'English', is_cws: false },
      { id: 'sch-anc-4', locale_id: 'loc-anchorage', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
      { id: 'sch-anc-5', locale_id: 'loc-anchorage', service_type: 'CWS', day_of_week: 0, day_name: 'Sunday', start_time: '12:00', language: 'English', is_cws: true },
    ],
  },
  {
    id: 'loc-juneau-gws',
    district_id: 'dist-alaska',
    name: 'Juneau GWS',
    slug: 'juneau-alaska',
    kind: 'group_worship_service',
    address: '8910 Glacier Hwy, Juneau, AK 99801, United States',
    latitude: 58.3614,
    longitude: -134.5786,
    phone: '907-351-1337',
    languages: ['English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-jun-1', locale_id: 'loc-juneau-gws', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-jun-2', locale_id: 'loc-juneau-gws', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
    ],
  },
  {
    id: 'loc-fairbanks',
    district_id: 'dist-alaska',
    name: 'Fairbanks',
    slug: 'fairbanks-alaska',
    kind: 'local_congregation',
    address: '1598 Westwood Way, Fairbanks, AK 99709, United States',
    latitude: 64.8427,
    longitude: -147.8185,
    phone: '907-456-1122',
    languages: ['English', 'Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-fbk-1', locale_id: 'loc-fairbanks', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-fbk-2', locale_id: 'loc-fairbanks', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
      { id: 'sch-fbk-3', locale_id: 'loc-fairbanks', service_type: 'CWS', day_of_week: 0, day_name: 'Sunday', start_time: '11:45', language: 'English', is_cws: true },
    ],
  },
  {
    id: 'loc-wasilla-gws',
    district_id: 'dist-alaska',
    name: 'Wasilla GWS',
    slug: 'wasilla-alaska-gws',
    kind: 'group_worship_service',
    address: 'Wasilla, AK 99654, United States',
    latitude: 61.5814,
    longitude: -149.4394,
    phone: '907-887-9404',
    languages: ['English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-was-1', locale_id: 'loc-wasilla-gws', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '14:00', language: 'English', is_cws: false },
    ],
  },

  // Central / NCR (Metro Manila)
  {
    id: 'loc-central-temple',
    district_id: 'dist-central',
    name: 'Templo Central (Central Temple)',
    slug: 'templo-central',
    kind: 'local_congregation',
    address: 'No. 1 Central Ave., New Era, Quezon City 1107, Philippines',
    latitude: 14.6644,
    longitude: 121.0544,
    phone: '+63 2 8981 4311',
    email: 'info@iglesianicristo.net',
    languages: ['Tagalog', 'English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-tem-1', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '05:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-tem-2', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '18:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-tem-3', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '05:45', language: 'English', is_cws: false },
      { id: 'sch-tem-4', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-tem-5', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 6, day_name: 'Saturday', start_time: '05:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-tem-6', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 6, day_name: 'Saturday', start_time: '18:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-tem-7', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '05:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-tem-8', locale_id: 'loc-central-temple', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '09:45', language: 'English', is_cws: false },
      { id: 'sch-tem-9', locale_id: 'loc-central-temple', service_type: 'CWS', day_of_week: 0, day_name: 'Sunday', start_time: '13:00', language: 'Tagalog', is_cws: true },
    ],
  },
  {
    id: 'loc-capitol',
    district_id: 'dist-quezon-city',
    name: 'Capitol',
    slug: 'capitol-quezon-city',
    kind: 'local_congregation',
    address: 'Commonwealth Ave., Matandang Balara, Quezon City, Philippines',
    latitude: 14.6738,
    longitude: 121.0775,
    phone: '+63 2 8931 5201',
    languages: ['Tagalog', 'English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-cap-1', locale_id: 'loc-capitol', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '19:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-cap-2', locale_id: 'loc-capitol', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '05:45', language: 'English', is_cws: false },
      { id: 'sch-cap-3', locale_id: 'loc-capitol', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '06:00', language: 'Tagalog', is_cws: false },
      { id: 'sch-cap-4', locale_id: 'loc-capitol', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
      { id: 'sch-cap-5', locale_id: 'loc-capitol', service_type: 'CWS', day_of_week: 6, day_name: 'Saturday', start_time: '09:00', language: 'Tagalog', is_cws: true },
    ],
  },
  {
    id: 'loc-cubao',
    district_id: 'dist-quezon-city',
    name: 'Cubao',
    slug: 'cubao-quezon-city',
    kind: 'local_congregation',
    address: '15th Ave., Murphy, Cubao, Quezon City, Philippines',
    latitude: 14.6192,
    longitude: 121.0621,
    phone: '+63 2 8911 3490',
    languages: ['Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-cub-1', locale_id: 'loc-cubao', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '19:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-cub-2', locale_id: 'loc-cubao', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '05:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-cub-3', locale_id: 'loc-cubao', service_type: 'Worship', day_of_week: 6, day_name: 'Saturday', start_time: '18:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-cub-4', locale_id: 'loc-cubao', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '06:00', language: 'Tagalog', is_cws: false },
    ],
  },
  {
    id: 'loc-makati-locale',
    district_id: 'dist-makati',
    name: 'Makati',
    slug: 'makati-locale',
    kind: 'local_congregation',
    address: 'Gil Puyat Ave. cor. Dian St., Palanan, Makati City, Philippines',
    latitude: 14.5574,
    longitude: 121.0022,
    phone: '+63 2 8844 7123',
    languages: ['Tagalog', 'English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-mak-1', locale_id: 'loc-makati-locale', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '19:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-mak-2', locale_id: 'loc-makati-locale', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '06:00', language: 'English', is_cws: false },
      { id: 'sch-mak-3', locale_id: 'loc-makati-locale', service_type: 'Worship', day_of_week: 6, day_name: 'Saturday', start_time: '18:30', language: 'Tagalog', is_cws: false },
      { id: 'sch-mak-4', locale_id: 'loc-makati-locale', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '07:00', language: 'English', is_cws: false },
      { id: 'sch-mak-5', locale_id: 'loc-makati-locale', service_type: 'CWS', day_of_week: 0, day_name: 'Sunday', start_time: '11:00', language: 'English', is_cws: true },
    ],
  },
  {
    id: 'loc-palanan-ext',
    district_id: 'dist-makati',
    name: 'Palanan Extension',
    slug: 'palanan-extension',
    kind: 'extension',
    address: 'Bautista St., Palanan, Makati City, Philippines',
    latitude: 14.5612,
    longitude: 121.0055,
    languages: ['Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-pal-1', locale_id: 'loc-palanan-ext', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-pal-2', locale_id: 'loc-palanan-ext', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '08:00', language: 'Tagalog', is_cws: false },
    ],
  },
  {
    id: 'loc-sta-ana',
    district_id: 'dist-maynila',
    name: 'Sta. Ana',
    slug: 'sta-ana-maynila',
    kind: 'local_congregation',
    address: 'Punta, Sta. Ana, Manila, Philippines',
    latitude: 14.5828,
    longitude: 121.0189,
    phone: '+63 2 8562 1088',
    languages: ['Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-sta-1', locale_id: 'loc-sta-ana', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '19:30', language: 'Tagalog', is_cws: false },
      { id: 'sch-sta-2', locale_id: 'loc-sta-ana', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '05:30', language: 'Tagalog', is_cws: false },
      { id: 'sch-sta-3', locale_id: 'loc-sta-ana', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '06:00', language: 'Tagalog', is_cws: false },
    ],
  },

  // US - Los Angeles & Bay Area
  {
    id: 'loc-los-angeles',
    district_id: 'dist-la-county',
    name: 'Los Angeles',
    slug: 'los-angeles-california',
    kind: 'local_congregation',
    address: '143 E. 43rd Pl., Los Angeles, CA 90011, United States',
    latitude: 34.0069,
    longitude: -118.2711,
    phone: '323-231-1122',
    languages: ['English', 'Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-la-1', locale_id: 'loc-los-angeles', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-la-2', locale_id: 'loc-los-angeles', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
      { id: 'sch-la-3', locale_id: 'loc-los-angeles', service_type: 'CWS', day_of_week: 0, day_name: 'Sunday', start_time: '12:00', language: 'English', is_cws: true },
    ],
  },
  {
    id: 'loc-san-francisco',
    district_id: 'dist-bay-area',
    name: 'San Francisco',
    slug: 'san-francisco-california',
    kind: 'local_congregation',
    address: '280 Industrial St., San Francisco, CA 94124, United States',
    latitude: 37.7428,
    longitude: -122.4049,
    phone: '415-822-4211',
    languages: ['English', 'Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-sf-1', locale_id: 'loc-san-francisco', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-sf-2', locale_id: 'loc-san-francisco', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:30', language: 'English', is_cws: false },
    ],
  },
  {
    id: 'loc-new-york-locale',
    district_id: 'dist-new-york',
    name: 'Long Island City (New York)',
    slug: 'long-island-city-new-york',
    kind: 'local_congregation',
    address: '42-12 28th St., Long Island City, NY 11101, United States',
    latitude: 40.7498,
    longitude: -73.9378,
    phone: '718-472-5200',
    languages: ['English', 'Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-ny-1', locale_id: 'loc-new-york-locale', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-ny-2', locale_id: 'loc-new-york-locale', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
    ],
  },

  // Europe - London & Rome
  {
    id: 'loc-london',
    district_id: 'dist-britain-south',
    name: 'London',
    slug: 'london-britain',
    kind: 'local_congregation',
    address: 'Wellington Way, Bow, London E3 4NE, United Kingdom',
    latitude: 51.5283,
    longitude: -0.0242,
    phone: '+44 20 8980 9100',
    languages: ['English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-lon-1', locale_id: 'loc-london', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-lon-2', locale_id: 'loc-london', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
      { id: 'sch-lon-3', locale_id: 'loc-london', service_type: 'CWS', day_of_week: 0, day_name: 'Sunday', start_time: '11:45', language: 'English', is_cws: true },
    ],
  },
  {
    id: 'loc-rome',
    district_id: 'dist-italy-north',
    name: 'Rome (Roma)',
    slug: 'rome-italy',
    kind: 'local_congregation',
    address: 'Via Casilina 1101, 00169 Roma, Italy',
    latitude: 41.8689,
    longitude: 12.5768,
    languages: ['Italian', 'English', 'Tagalog'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-rom-1', locale_id: 'loc-rome', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'Italian', is_cws: false },
      { id: 'sch-rom-2', locale_id: 'loc-rome', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
    ],
  },

  // Australia - Sydney
  {
    id: 'loc-sydney',
    district_id: 'dist-nsw',
    name: 'Sydney',
    slug: 'sydney-australia',
    kind: 'local_congregation',
    address: '42 Fourth Ave., Blacktown, NSW 2148, Australia',
    latitude: -33.7711,
    longitude: 150.9064,
    phone: '+61 2 9671 2288',
    languages: ['English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-syd-1', locale_id: 'loc-sydney', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:30', language: 'English', is_cws: false },
      { id: 'sch-syd-2', locale_id: 'loc-sydney', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '10:00', language: 'English', is_cws: false },
    ],
  },

  // Africa - Johannesburg
  {
    id: 'loc-johannesburg',
    district_id: 'dist-southern-africa',
    name: 'Johannesburg',
    slug: 'johannesburg-south-africa',
    kind: 'local_congregation',
    address: '154 Katherine St., Sandton, Johannesburg 2196, South Africa',
    latitude: -26.1076,
    longitude: 28.0567,
    languages: ['English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-jhb-1', locale_id: 'loc-johannesburg', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '19:00', language: 'English', is_cws: false },
      { id: 'sch-jhb-2', locale_id: 'loc-johannesburg', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '09:30', language: 'English', is_cws: false },
    ],
  },

  // Cebu City
  {
    id: 'loc-cebu-city',
    district_id: 'dist-cebu-city',
    name: 'Cebu City',
    slug: 'cebu-city',
    kind: 'local_congregation',
    address: 'General Maxilom Ave., Cebu City 6000, Philippines',
    latitude: 10.3129,
    longitude: 123.8967,
    phone: '+63 32 253 1290',
    languages: ['Cebuano', 'Tagalog', 'English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-ceb-1', locale_id: 'loc-cebu-city', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '19:45', language: 'Cebuano', is_cws: false },
      { id: 'sch-ceb-2', locale_id: 'loc-cebu-city', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '05:45', language: 'English', is_cws: false },
      { id: 'sch-ceb-3', locale_id: 'loc-cebu-city', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '06:00', language: 'Tagalog', is_cws: false },
      { id: 'sch-ceb-4', locale_id: 'loc-cebu-city', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '09:45', language: 'English', is_cws: false },
    ],
  },

  // Davao City
  {
    id: 'loc-davao-city',
    district_id: 'dist-davao-city',
    name: 'Davao City',
    slug: 'davao-city',
    kind: 'local_congregation',
    address: 'F. Torres St., Poblacion District, Davao City, Philippines',
    latitude: 7.0784,
    longitude: 125.6133,
    phone: '+63 82 221 4402',
    languages: ['Tagalog', 'Cebuano', 'English'],
    source_updated_at: '2026-09-24T00:00:00Z',
    schedule: [
      { id: 'sch-dvo-1', locale_id: 'loc-davao-city', service_type: 'Worship', day_of_week: 3, day_name: 'Wednesday', start_time: '19:45', language: 'Tagalog', is_cws: false },
      { id: 'sch-dvo-2', locale_id: 'loc-davao-city', service_type: 'Worship', day_of_week: 4, day_name: 'Thursday', start_time: '05:45', language: 'English', is_cws: false },
      { id: 'sch-dvo-3', locale_id: 'loc-davao-city', service_type: 'Worship', day_of_week: 0, day_name: 'Sunday', start_time: '06:00', language: 'Tagalog', is_cws: false },
    ],
  },
];

export const INITIAL_SNAPSHOT: DataSnapshot = {
  id: 'snap-seed-v2',
  created_at: '2026-09-24T18:00:00.000Z',
  storage_url: '/data/snapshots/snapshot-2026-09-24.json',
  record_counts: {
    regions: INITIAL_REGIONS.length,
    districts: INITIAL_DISTRICTS.length,
    locales: INITIAL_LOCALES.filter(l => l.kind === 'local_congregation').length,
    extensions: INITIAL_LOCALES.filter(l => l.kind === 'extension').length,
    group_worship_services: INITIAL_LOCALES.filter(l => l.kind === 'group_worship_service').length,
    schedules: INITIAL_LOCALES.reduce((acc, l) => acc + (l.schedule?.length || 0), 0),
  },
  status: 'success',
  description: 'Complete verified directory baseline with all 198 official districts across Americas, Asia, Europe, Australia-Oceania, Africa, and Philippines Regions.',
};
