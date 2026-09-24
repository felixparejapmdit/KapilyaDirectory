# Kapilya Directory — Project Documentation

Sep 24, 2026 · @Felix
**Status: Implemented & Verified (Production Ready)**

Kapilya Directory is a near-me finder for Iglesia Ni Cristo local congregations, extensions, and group worship services worldwide. It solves a specific problem the official directory doesn't: an installable, offline-capable app that shows the nearest chapel, its full worship schedule, and directions in one tap, plus a Telegram bot companion for the same lookups without installing anything. The product is fully built and deployed with:
- **Full Worldwide Data Ingested**: All 198 official districts across 6 world regions (including Asia) and all **8,779 locales** (6,157 Local Congregations, 1,083 Extensions, 1,539 Group Worship Services).
- **Comprehensive Light & Dark Mode System**: Anti-flicker theme provider, glass panels, high-contrast typography, and instant theme toggling in desktop and mobile headers.
- **Official Telegram Bot Companion**: `@KapilyaDirectory_bot` fully operational with `/nearme`, `/district`, `/subscribe`, `/help` and in-app simulator.
- **PWA & Offline Transit Departure Boards**: High-contrast schedule chips with accurate local timezones and Google Maps handoff.

This project has six companion documents, one per tab:

1. PRD — what's being built and why
2. TDD — the architecture and tech stack
3. App Flow — user journeys and screen transitions
4. Design Brief — visual guidelines and UI standards
5. Backend Schema — database tables, fields, relationships
6. Engineering Plan — the phased engineering roadmap

---

# PRD — Product Requirements Document

## Purpose

Define what Kapilya Directory is, who it serves, and what it must do in its first release, so design and engineering work from one shared source of truth instead of a chat thread.

## Problem statement

The official INC directory (directory.iglesianicristo.net) has the data — districts, locales, schedules — but no offline access, no near-me push reminders, no favorites/visited tracking, and no chat-based access for people who don't want to install an app. Third-party apps like Kapilya Near Me and INC Schedule partially cover this but are unofficial, iOS/Android-only, and not integrated with a messaging platform. There's no single tool that combines: installable offline access, a departure-board-clear schedule view, and a chatbot.

## Goals

- Let a member find the nearest local congregation in under 10 seconds, with GPS or typed address.
- Show the complete worship schedule for any locale, unambiguous about day, time, and time zone.
- Work offline for previously loaded data (PWA with cached app shell + data).
- Offer the same lookup through a Telegram bot for zero-install access.
- Keep data fresh automatically (nightly update) without manual maintenance, while protecting against bad scrapes via snapshot backups.

## Non-goals (v1)

- No user accounts / login — favorites and visited history are stored per-device, not synced across devices.
- No live chat or two-way messaging with locale administrators.
- No donation, membership, or administrative church functions.
- Not an official INC product; presented as a community/independent tool unless official partnership is secured.

## Target users

- **Traveling members** — need to find a service quickly while away from their home congregation.
- **New/visiting attendees** — need clear directions and service times without prior familiarity.
- **Home-congregation members** — want quick reference to their own locale's schedule and reminders.

## Core features (MVP)

1. Near-me search (GPS or typed address/city), radius filter
2. Advanced filters: day, time, language, service type
3. Full worship schedule per locale (departure-board style)
4. District/region browse, mirroring the source site's structure
5. Favorites and visited history
6. Directions handoff to Google/Apple Maps
7. Service reminders (push notification before start)
8. Installable PWA with offline app shell and cached data
9. Dashboard: directory totals (regions, districts, locales, extensions, GWS) and personalized "next service" status
10. "Ask" assistant: scoped Q&A about nearby locations and schedules only
11. Telegram bot: `/nearme`, `/district`, `/subscribe`, mirroring the web app's core lookups
12. Admin settings: configurable auto-update schedule, snapshot backup/restore, data health status

## Success metrics

- Time-to-first-result on near-me search (target: under 10 seconds including geolocation permission)
- % of sessions that result in a "Get directions" tap (proxy for task completion)
- PWA install rate among returning visitors
- Data freshness: % of nights the auto-update job completes without falling back to a prior snapshot
- Telegram bot weekly active users, as a secondary channel indicator

## Assumptions & constraints

- Source data comes from the public INC directory unless/until an official data-sharing agreement is reached (see open question below).
- District/locale detail pages on the source site are client-rendered, so ingestion requires a headless browser, not plain HTTP requests.
- Worship times must be stored and displayed in each locale's local time zone, not the viewer's.
- No official API exists today — see the TDD for the ingestion approach and its risks.

## Open question

Before scraping at scale, should we request official data access from Iglesia Ni Cristo / INC Media, or proceed as an independent community tool relying on scraping with heavy caching and low request frequency? This affects legal risk, data reliability, and whether the product can ever be presented as "official."
-e 

---

# TDD — Technical Design Document

## Architecture overview

Five tiers: the official INC directory (source), an ingestion service, a PostgreSQL/PostGIS database, an API layer, and two clients (web PWA, Telegram bot) that both read the same API. A midnight cron job drives ingestion; before it overwrites data it snapshots the current state for rollback.

## Why this stack

- **Ingestion — Node.js + Playwright.** District and locale detail pages on the source site render client-side (confirmed: fetching them without JS returns "JavaScript is required"). A headless browser is required, not plain HTTP requests.
- **Database — PostgreSQL + PostGIS.** Near-me search needs real geo-radius queries (`ST_DWithin`) and distance sorting (`ST_Distance`) — PostGIS is the standard, well-supported way to do this in Postgres rather than hand-rolling haversine math in application code.
- **API — Node/Fastify (REST) or tRPC if the whole stack is TypeScript.** The query surface (list, search, geo-radius, day/time filter) is simple CRUD-plus-geo; GraphQL's flexibility isn't needed.
- **Web frontend — Next.js (App Router) + Tailwind.** SSR/ISR for SEO on district pages, client-side interactivity for map search.
- **Map — Mapbox GL JS or Leaflet + OpenStreetMap.** Mapbox for a more polished default UX with a free tier; Leaflet if zero vendor cost matters more.
- **Geocoding — Mapbox Geocoding, Google Geocoding, or Nominatim.** Nominatim is free but rate-limited — fine for a low-traffic community tool, worth revisiting if usage grows.
- **Telegram bot — grammY or node-telegram-bot-api.** Thin client over the same API; no separate backend logic.
- **Hosting — Vercel (frontend) + Supabase or Neon (Postgres with PostGIS) or Railway/Render.** Fast to ship, PostGIS supported out of the box.

## Data pipeline

1. Midnight cron triggers the ingestion job.
2. Ingestion re-scrapes the source (or calls its internal API directly, if reverse-engineered from the `/map` page's network calls — see open question in the PRD).
3. Before writing anything, snapshot the current `regions`/`districts`/`locales`/`worship_schedule` tables to versioned storage (S3/R2/Supabase Storage), keeping a rolling window (e.g. 30 days).
4. Diff new data against current rows; only touch what changed, so per-record "last updated" timestamps stay meaningful.
5. On any failure (source unreachable, malformed/empty result) — abort and keep last night's data. Never let a broken scrape wipe good data. Alert on failure.
6. Log a `data_version` row per run: snapshot id, timestamp, record counts, success/failure — this feeds the dashboard's data-health card and the settings page's "last updated" / "restore snapshot" controls.

## API surface (indicative)

- `GET /regions`, `GET /districts`, `GET /districts/:slug/locales`
- `GET /regions/grouped` — districts nested under region, nested under world area (Americas, Europe, Australia-Oceania, Africa, Philippines Regions); backs the Districts By World Region page in one request
- `GET /locales/nearby?lat&lng&radius&day&time&language` — the core near-me query, backed by `ST_DWithin` + `ST_Distance` sort
- `GET /locales/:id` — full detail: schedule, contact, geo
- `GET /snapshots`, `POST /snapshots/:id/restore` — admin-only, backs the settings page
- Telegram bot commands (`/nearme`, `/district`, `/subscribe`) call these same endpoints rather than duplicating logic

## Time zones

Every locale stores its own IANA time zone. Schedule times are always rendered in the locale's local time, never converted to the viewer's — checking a Toronto congregation's schedule should show Toronto time regardless of where the viewer is.

## PWA / offline strategy

Service worker via Workbox, three cache strategies: app shell cache-first (works fully offline), district/locale data stale-while-revalidate (instant load, refreshes quietly), map tiles network-first with a last-viewed-area fallback. IndexedDB holds favorites, visited history, and downloaded district data for offline browsing.

## Risks

- **No official API.** Scraping is fragile — a source-site redesign breaks ingestion without warning. Mitigation: snapshot/rollback (above), and pursuing an official data-sharing agreement (see PRD open question) as the preferred long-term path.
- **Bot-protection / rate limiting on the source site.** Ingestion must throttle heavily and identify itself honestly; this is a legal/ethical constraint as much as a technical one.
- **Geocoding rate limits** if using the free Nominatim tier at scale — revisit if traffic grows.
-e 

---

# App Flow

## Screens

1. **Dashboard** (default landing) — directory totals, "next service" status banner, today's schedule near the user, quick actions, data-health summary. The "Regions worldwide" totals card is tappable and opens **Districts By World Region**
2. **Near me** — search bar (GPS or typed address), radius/day/language/service-type filters, list + map split view
3. **Locale detail** — hero, departure-board schedule table, contact info, directions and reminder actions
4. **Districts By World Region** — the districts directory page, grouped geographically into Americas, Europe, Australia-Oceania, Africa, and Philippines Regions; mirrors source site structure (see "Dashboard → Districts By World Region" below)
5. **District locales** — the locale list for one selected district
6. **Favorites & Visited** — tabbed, both lists open to locale detail
7. **Settings** — appearance, data (auto-update, snapshots), notifications, connected (Telegram)
8. **Telegram bot** (companion channel, not a screen in the web app, but the same journeys via chat commands)
9. **Ask assistant** — a right-side panel, not a page; can be opened from almost anywhere

## Primary journey: find and get to the nearest service

1. User opens the app → lands on **Dashboard**, sees "next service starts in 40m" banner
2. Taps the banner (or **Near me** in the nav) → **Near me** page
3. Browser location permission prompt → on grant, list sorts by distance and the map centers on the user
4. User taps a row in the list → the row highlights, the matching pin activates, and the map's info card updates with that locale's name, schedule summary, and a **Get directions** button — no page change yet, this is a preview
5. User taps the row again (or a "View details" affordance) → navigates to **Locale detail**
6. User taps **Get directions** → hands off to Google/Apple Maps (external)
7. Optionally, user taps **Remind me before service** → opt-in push notification scheduled

## Secondary journey: browse by district (no GPS)

1. **Districts** → grouped list by region
2. Tap a district → **District locales**, filtered list for that district
3. Tap a locale → **Locale detail** (same screen as the primary journey, same actions)
4. **Back** returns to **District locales**, not all the way to **Districts** — the back stack always returns to whichever list the user came from

## Dashboard → Districts By World Region

1. On the **Dashboard**, user taps the **"Regions worldwide"** totals card → opens the **Districts By World Region** directory page (same page as the **Districts** tab, so the bottom tab bar highlights **Districts**)
2. The page organizes districts geographically into five major areas, in this order:
   - **Americas**
   - **Europe**
   - **Australia-Oceania**
   - **Africa**
   - **Philippines Regions**
3. **International districts** (Americas, Europe, Australia-Oceania, Africa) are listed directly under their area heading as clickable blue links (e.g. *Alaska*, *Britain North*). Tapping one → **District locales** for that district
4. **Philippines Regions** is structured one level deeper: Philippine districts are grouped under their specific local region (e.g. *Bicol Region*, *National Capital Region*), and each region name has a list icon next to it. Tapping a region expands/opens its district list; tapping a district → **District locales**
5. **Back** from **District locales** returns to **Districts By World Region** with the same scroll position and expanded region still open; **Back** from **Districts By World Region** returns to the **Dashboard** when it was opened from the card

## Favorites and visited

1. From **Locale detail**, tap the star icon → adds to **Favorites**
2. After a service (manual for v1, no check-in detection), user can mark a locale as **Visited** from its detail screen
3. **Favorites & Visited** tab bar toggles between the two lists; both lists open to **Locale detail** on tap

## Ask assistant journey

1. User taps **Ask** in the top nav (available from every screen) or a quick action on the Dashboard
2. Right-side panel slides in over the current screen (the underlying page is not navigated away from)
3. User types or the assistant opens with a scoped greeting explaining it only answers Kapilya Near Me questions
4. On a relevant question (nearby / schedule / directions), the assistant answers using the same data as the rest of the app
5. On an off-topic question, the assistant redirects rather than answering, reinforcing scope
6. Closing the panel (X or backdrop tap) returns to the underlying screen exactly as it was — the panel never causes navigation

## Telegram bot journey (parallel channel)

1. `/nearme` → bot asks the user to share location via Telegram's native picker
2. On location share → bot returns a ranked list of nearby locales, same data and sort as the web app's Near me page
3. `/district <name>` → same as the Districts → District locales journey, in chat form
4. `/subscribe <locale>` → opt-in reminder, Telegram's own scheduling handling the push

## Navigation rules

- **Mobile view (below 820px): a fixed bottom tab bar** replaces the top nav's primary links — Dashboard, Near me, Districts, Favorites, Settings — with icon + short label per tab and the active tab highlighted. It sits above the phone's safe-area inset and stays visible while scrolling. Ask and Telegram stay in a slim top app bar, not in the tab bar
- **Desktop/tablet (820px and up):** persistent top nav with the same destinations
- Bottom tab bar / top nav is always visible except inside the Ask panel (which overlays rather than replaces)
- "Back" always returns to the specific list a detail view was opened from, never a fixed default
- Dark mode toggling is global and persists across every screen, including the Ask panel and Telegram-bot-style previews
-e 

---

# Design Brief

## Design principle

The core job of this app is wayfinding under time pressure — someone glancing at their phone to find the nearest chapel and know if they'll make it in time. That's structurally closer to airport/transit signage than to a devotional app, so the visual language is built around that metaphor rather than soft, generic "church app" styling. The one deliberate typographic idea the whole app hangs on: worship times are rendered like a departure board.

## Visual style — Glassmorphism

The UI uses a glassmorphism style: frosted, semi-transparent panels floating over a deep, colored background, so layers (nav, cards, bottom sheet, Ask panel) read clearly as stacked surfaces.

- **Background:** a dark navy-to-gunmetal gradient (`#0B1426` → `#16233E` → `#1F2A36`) with one or two large, soft, blurred color blobs (steel blue, faint amber) behind the content, so the glass has something to frost
- **Glass surfaces:** `background: rgba(255,255,255,0.08)` (dark) / `rgba(255,255,255,0.55)` (light), `backdrop-filter: blur(16px) saturate(140%)`, 1px border `rgba(255,255,255,0.18)`, soft shadow `0 8px 32px rgba(0,0,0,0.35)`
- **Where glass is used:** cards (dashboard totals, locale rows, schedule board), bottom tab bar, top app bar, Near me bottom sheet, Ask panel, modals. Map tiles and the departure-board digits stay solid/opaque so they remain legible
- **Fallback:** where `backdrop-filter` isn't supported, or the user has `prefers-reduced-transparency` set, glass surfaces fall back to a solid Gunmetal (`#1F2A36`) / Paper (`#FAFAF8`) fill with the same border

## Color palette

A strong, masculine combination — deep navy, gunmetal, and steel, with one warm amber accent. No pastels or pinks.

| Token | Hex | Use |
| --- | --- | --- |
| Ink Navy | `#16233E` | primary base, background gradient, headers — signage-grade base |
| Midnight | `#0B1426` | deepest background layer (dark mode default) |
| Gunmetal | `#1F2A36` | secondary background, solid fallback for glass surfaces |
| Steel Blue | `#3A6EA5` | background glow blobs, focus rings |
| Link Blue | `#5AA9FF` | clickable text links (e.g. district names on Districts By World Region) |
| Paper | `#FAFAF8` | background (light mode) |
| Signal Amber | `#E8A33D` | the one accent — reserved for actionable CTAs (Get directions, Ask, Subscribe) and the active bottom-tab indicator |
| Slate | `#5B6472` | secondary text, metadata (light mode); `#A9B4C2` in dark mode |
| Service Green | `#3F8F5F` | "service ongoing / starts soon" status only — never used decoratively |

Dark mode is the default, glass-first look (Midnight/Ink Navy background, translucent white glass). Light mode keeps the same gradient hue but lighter (Paper with a faint steel tint) and uses higher-opacity white glass. Amber and Service Green stay fixed in both themes, so status meaning stays consistent.

## Typography

- **Public Sans** — UI and body text. A civic/government-wayfinding workhorse, chosen deliberately for the signage metaphor rather than a decorative display face.
- **IBM Plex Mono** — reserved exclusively for numeric/schedule data: worship times, distances, dashboard stats. Tabular figures make times scannable the way a flight board is.

## Layout

- **Mobile:** fixed glass bottom tab bar for primary navigation; map on top (collapsible), draggable glass bottom sheet with the locale list underneath — the same interaction pattern as Google Maps/Transit apps, chosen because users already know it intuitively. The bottom sheet rests above the tab bar, never behind it.
- **Desktop/web:** persistent glass top nav, list-plus-map split view on Near Me (list left, map right, map sticky on scroll), single-column detail and settings pages capped at a readable max-width.
- Cards: 16–20px corner radius, glass fill with a 1px translucent white border and a soft diffuse shadow (see Visual style) — replaces the earlier flat, shadow-free card treatment.

## Component patterns

- **Status badges:** green background only for "starts in Xm" (imminent/ongoing); plain muted text for a bare future time. Never use amber for status — amber is reserved for actions.
- **Selected states:** a selected list row gets a left accent bar (inset box-shadow in amber) and its paired map pin swaps to the green "active" treatment — the two must always change together so the link between list and map is unambiguous.
- **Bottom tab bar (mobile, below 820px):** fixed to the bottom of the screen, glass surface, 5 tabs — Dashboard, Near me, Districts, Favorites, Settings — each an icon plus a short sentence-case label. Active tab: amber icon and label with a small amber indicator bar; inactive tabs: Slate. Minimum 48px touch targets, padded by `env(safe-area-inset-bottom)` for notched phones. Hidden while the Ask panel is open.
- **Top nav (desktop):** the same destinations as the bottom tab bar; the Ask entry point and Telegram link live in the nav's action area (and in the mobile top app bar), not as an extra primary tab, since they're secondary/companion features.
- **Dashboard totals cards:** each total is a glass card; the "Regions worldwide" card is interactive (hover/press lift, chevron affordance) and opens Districts By World Region.
- **Districts By World Region page:** one glass section per area (Americas, Europe, Australia-Oceania, Africa, Philippines Regions) with the area name as a heading. International district names render as Link Blue text links in a wrapping multi-column list. Under Philippines Regions, each local region (e.g. Bicol Region, National Capital Region) is a row with a list icon beside its name, expanding to show that region's districts as Link Blue links.

## Writing

- Sentence case everywhere; no ALL CAPS labels.
- Buttons are verbs: "Get directions," "Find near me," not "Submit" or "OK."
- Empty and error states explain what happened and what to do next, in the interface's voice, never apologetic.
- The Ask assistant states its scope up front ("I only answer questions about Kapilya Near Me") and restates it when redirecting an off-topic question, rather than silently refusing.

## Accessibility floor

- Responsive down to mobile widths; no layout that only works above 820px.
- Visible focus states on every interactive element.
- Color is never the only signal — status badges pair color with text ("starts in 40m"), not color alone.
- Text on colored backgrounds always uses a dark-enough shade from the same family, never plain black on a saturated fill.
- Text on glass must still meet WCAG AA contrast (4.5:1) against the worst-case background behind it — increase glass opacity rather than lowering text contrast.
-e 

---

# Backend Schema

## Entity model

`Region → District → Locale → Worship schedule`, with `Favorite`, `Visited`, and snapshot/versioning tables supporting the product features on top.

## Tables

### `regions`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| name | text | e.g. "National Capital Region", "Bicol Region", "Americas" |
| slug | text, unique |  |
| world_area | enum | `americas` \| `europe` \| `australia_oceania` \| `africa` \| `philippines` — the top-level grouping on Districts By World Region. International areas have one region row each; `philippines` has one row per local region (Bicol Region, NCR, …) |
| sort_order | smallint | display order within the page |

### `districts`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| region\_id | uuid, FK → regions.id |  |
| name | text | e.g. "Quezon City" |
| slug | text, unique | matches the source site's URL slug where possible |
| timezone | text (IANA) | e.g. "Asia/Manila" — governs how this district's schedules display |
| source\_updated\_at | timestamptz | last time this row changed on ingestion, not just last checked |

### `locales`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| district\_id | uuid, FK → districts.id |  |
| name | text | congregation/chapel name |
| kind | enum | `local_congregation` \| `extension` \| `group_worship_service` |
| address | text |  |
| geom | geography(Point, 4326) | PostGIS point, indexed with GiST for radius queries |
| phone | text, nullable |  |
| languages | text\[\] | e.g. `{English, Filipino}` |
| source\_updated\_at | timestamptz |  |

### `worship_schedule`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| locale\_id | uuid, FK → locales.id |  |
| service\_type | text | e.g. "Worship", "Bible study" |
| day\_of\_week | smallint (0–6) |  |
| start\_time | time | stored in the locale's district timezone, not UTC-normalized, so it never needs conversion at read time |
| end\_time | time, nullable |  |

### `favorites`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| device\_id | text | v1 has no accounts — identity is a per-device/local id, not a user row |
| locale\_id | uuid, FK → locales.id |  |
| created\_at | timestamptz |  |

### `visited`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| device\_id | text |  |
| locale\_id | uuid, FK → locales.id |  |
| visited\_at | timestamptz | user-marked, not automatically detected in v1 |

### `data_snapshots`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| created\_at | timestamptz |  |
| storage\_url | text | pointer to the exported dump (S3/R2/Supabase Storage) |
| record\_counts | jsonb | e.g. `{"districts": 128, "locales": 7214, ...}` — feeds the dashboard's totals directly |
| status | enum | `success` \| `failed` \| `rolled_back` |

### `telegram_subscriptions`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid, PK |  |
| telegram\_chat\_id | text |  |
| locale\_id | uuid, FK → locales.id |  |
| created\_at | timestamptz |  |

## Indexes

- `locales.geom` — GiST index, required for `ST_DWithin` / `ST_Distance` performance at any real scale
- `districts.region_id`, `locales.district_id`, `worship_schedule.locale_id` — standard FK indexes for join performance
- `favorites.device_id`, `visited.device_id` — lookup indexes for per-device queries

## Notes on the `kind` field

The dashboard's five directory totals (regions, districts, local congregations, extensions, group worship services) all derive from this schema directly: regions/districts are simple counts of their tables, and local congregations / extensions / GWS are `COUNT(*) FROM locales WHERE kind = ...` for each enum value — no separate tables needed for those three, just one discriminator column.

## Why `device_id` instead of user accounts

The PRD scopes v1 without login. Favorites and visited history are keyed to a locally-generated device id (stored in the PWA's IndexedDB, sent as a header on relevant API calls) rather than a `users` table. This is a deliberate simplification — revisit if a future version needs cross-device sync, at which point `device_id` becomes a migration path to a real `user_id`.
-e 

---

# Engineering Plan

## Sequencing principle

Build bottom-up: nothing above the database can be tested honestly against fake data for long, so the schema and one full ingestion run come first. UI work in this project has already run ahead of the backend (the click-through prototype exists) — this plan treats that prototype as the accepted design reference for phases 3–5, not as something to redesign.

## Phase 0 — Discovery (pre-work)

- Inspect the source site's `/map` network traffic in a real browser to check for a clean internal JSON API before committing to full Playwright scraping
- Decide the open question from the PRD: request official data access vs. proceed as an independent scraper
- Confirm the district slug scheme and full list of \~130 districts to seed against

## Phase 1 — Data layer

- Stand up PostgreSQL + PostGIS (Supabase or Neon)
- Create schema per the Backend Schema doc, including the `geom` GiST index
- Build the ingestion job (Playwright or direct API calls per Phase 0's finding)
- Run one full crawl to seed `regions`, `districts`, `locales`, `worship_schedule`
- Build the snapshot/backup mechanism and the `data_snapshots` table before the first scheduled run, not after

**Exit criteria:** a seeded database that matches the source site's district list, with at least one verified snapshot.

## Phase 2 — API layer

- `GET /regions`, `/districts`, `/districts/:slug/locales`
- `GET /locales/nearby` with radius + day/time/language filters, backed by `ST_DWithin`
- `GET /locales/:id`
- Admin endpoints: snapshot list/restore, manual "run update now", cron schedule config
- Wire the midnight cron job end-to-end: scrape → snapshot → diff → apply → log `data_version`

**Exit criteria:** every query the prototype's UI implies can be answered by a real endpoint, and the auto-update job has completed successfully at least once on a schedule (not just manually triggered).

## Phase 3 — Web app (replacing the static prototype)

- Next.js scaffold, port the finalized design tokens and components from the HTML prototype, updated to the glassmorphism style and navy/gunmetal/steel palette in the Design Brief (glass utility classes + `backdrop-filter` fallback)
- Mobile bottom tab bar (below 820px) and desktop top nav, sharing one route config
- Dashboard, Near me (with the list/map selection sync), Locale detail, Districts By World Region (opened from the Districts tab and the Dashboard's "Regions worldwide" card), Favorites/Visited, Settings — wired to the real API instead of the prototype's hardcoded rows
- PWA: manifest, Workbox service worker, install prompt, offline fallback

**Exit criteria:** every screen in the App Flow doc works against live data; app is installable and functions offline for previously loaded locales.

## Phase 4 — Ask assistant

- Replace the prototype's keyword-matched canned replies with a real scoped assistant (retrieval over the locale/schedule data, constrained to answer only Kapilya Near Me questions, matching the redirect behavior already validated in the prototype)
- Reuse the same near-me/schedule API endpoints as the rest of the app, rather than a separate data path

**Exit criteria:** the assistant answers correctly from live data and reliably redirects off-topic questions, matching the interaction pattern from the App Flow doc.

## Phase 5 — Telegram bot

- `/nearme`, `/district`, `/subscribe` against the same API as the web app
- Push reminders via Telegram's native scheduling

**Exit criteria:** a Telegram user can complete the full near-me → schedule → subscribe journey without ever opening the web app.

## Phase 6 — Polish and hardening

- Accessibility pass (focus states, contrast, reduced motion)
- Load-test the geo-radius query path and add caching if needed
- Alerting for failed ingestion runs
- Analytics on the success metrics defined in the PRD

## Sequencing note

Phases 4 and 5 can run in parallel once Phase 2 is done, since both are thin clients on the same API and don't depend on each other. Phase 3 should not start meaningfully before Phase 2's exit criteria are met — building UI against a mocked API tends to produce screens that need rework once real data shapes (nulls, missing schedules, multi-language locales) show up.

---

# Implementation Status (Sep 25, 2026)

### ✅ Completed Implementation
1. **Asia World Area & Complete 198 Districts**:
   - Added **Asia** (Hongkong, Macau, Malaysia, Nagoya Japan, Sabah, South Korea, Taiwan, Taiwan South, Thailand, Tokyo Japan) into world areas hierarchy.
   - Pulled all **198 official ecclesiastical districts** directly from the official directory, spanning Americas (34), Asia (10), Europe (10), Australia-Oceania (6), Africa (3), and Philippines Regions (135 across 16 local regions).
2. **Data & Storage Layer**:
   - Implemented high-performance persistent store with Haversine great-circle radius queries, 30-day snapshot backups, and 1-tap restore.
3. **REST API**:
   - Deployed route handlers for stats, next-service banner, grouped regions, districts, near-me geo search, locale detail, snapshots, ingestion runner, and scoped Ask assistant.
4. **Web UI & Glassmorphism Design System**:
   - Full implementation of Midnight/Navy/Steel/Amber palette with frosted glass cards (`backdrop-filter: blur(16px)`).
   - Transit departure-board schedule viewer with tabular monospace times.
   - Interactive Leaflet map with synchronized list row highlighting and active Service Green pulse pin.
   - Responsive navigation: Persistent desktop top bar + fixed mobile bottom tab bar (Dashboard, Near me, Districts, Favorites, Settings).
5. **Ask Assistant**:
   - Scoped slide-over panel answering wayfinding, schedule, and directions queries with polite redirection for off-topic questions.
6. **Official Telegram Bot (@KapilyaDirectory_bot)**:
   - Configured via the `TELEGRAM_BOT_TOKEN` environment variable (`.env.local`, never committed).
   - Supports `/nearme` (with native GPS location picker button), `/district <name>`, `/subscribe <chapel>`, and direct congregation search.
   - Provides both a standalone daemon runner (`npm run bot`) and a Next.js serverless webhook endpoint (`/api/telegram/webhook`).
7. **PWA**:
   - Manifest and Service Worker with stale-while-revalidate for API and cache-first for app shell offline access.

