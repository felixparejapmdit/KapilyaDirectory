# Kapilya Directory

A near-me finder for Iglesia Ni Cristo local congregations, extensions, and group worship services
worldwide: worship schedules in a departure-board layout, a map of nearby chapels, directions, an Ask
assistant, and a Telegram bot. Built with Next.js (App Router), Tailwind CSS, and Leaflet.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values you need (see Credentials below)
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm run start -- -p 3000
npm run bot                  # optional: Telegram bot (long polling), reads .env.local
```

No database server, account, or migration is needed: the app runs from the data file in the repo.

## Data storage

### There is no database

All directory data lives in one JSON file, **`data/store.json`** (about 16 MB), which is committed
to the repo. The server reads it into memory (`src/lib/store.ts`) and reloads it automatically
whenever the file changes on disk, so a sync or a restore shows up without a restart.

| Top-level key | Contents |
| --- | --- |
| `regions` | 21 world regions (`id`, `name`, `slug`, `world_area`, `sort_order`) |
| `districts` | 198 ecclesiastical districts (`id`, `region_id`, `name`, `slug`, `timezone`) |
| `locales` | ~8,800 local congregations, extensions, and GWS (see below) |
| `snapshots` | List of rollback snapshots (the files themselves are in `data/snapshots/`) |
| `last_updated`, `last_sync` | When the data last changed, and the result of the last sync |

Each locale has `id` (`loc-<slug>`), `slug` (the official directory's slug), `name`, `kind`
(`local_congregation`, `extension`, or `group_worship_service`), `district_id`, `address`,
`latitude`, `longitude`, `phone`, `email`, `languages`, `source_updated_at`, and `schedule`: a list
of services with `day_of_week` (0 = Sunday), `day_name`, `start_time` (24-hour `HH:MM`, in the
district's local time zone), `language`, optional `language2` (e.g. sign language), and `is_cws`.

The source of truth is the official directory at
[iglesianicristo.net/directory](https://iglesianicristo.net/directory); `data/store.json` is a synced
copy. Don't edit it by hand: the next sync overwrites locale records from the source.

### Keeping the data current

- **Every 6 hours** (12 AM, 6 AM, 12 PM, 6 PM in `SYNC_TIMEZONE`, default `Asia/Manila`):
  - a running server syncs itself (set `KAPILYA_AUTO_SYNC=off` to disable);
  - the GitHub Action in `.github/workflows/sync-directory.yml` syncs, commits `data/store.json`
    when anything changed, and the push redeploys the site.
- **Settings → Run Sync Now** starts the same sync on demand and shows its progress.
- **CLI**: `npm run sync:directory` (add `--dry-run` to preview, `--only=slug1,slug2` for a few locales).

A full sync fetches every locale page (about 8,800) at a gentle rate and takes 30 to 90 minutes.
A sync that finds no changes leaves `store.json` untouched, and locales whose page can't be reached
keep their previous data.

### Backups and restore

Before a sync (or **Take Snapshot** in Settings) changes anything, the full current store is saved
to `data/snapshots/snapshot-<id>.json`. The newest 30 are kept; older files are deleted. Restore any
of them from **Settings → Data Pipeline & Rollback Snapshots**.

Snapshots are local backups only: `data/snapshots/` is gitignored (each file is ~16 MB). On GitHub,
the commit history of `data/store.json` serves as the backup instead.

### Hosting on Vercel (read-only)

Serverless hosts can't write files, so on Vercel (detected by the `VERCEL` variable, or forced with
`KAPILYA_READ_ONLY=1`) the store is served exactly as deployed: Run Sync Now, the in-app schedule,
snapshots, and restore are turned off. The GitHub Action keeps the deployed data current instead.

If you run a local server and also pull the Action's data commits, discard your local sync results
first (`git checkout data/store.json`), or set `KAPILYA_AUTO_SYNC=off` locally.

### Data kept in the visitor's browser

Nothing about visitors is stored on the server. Each browser keeps its own preferences in
`localStorage`: `kapilya_active_location` (the chosen or GPS location), `kapilya_favorites`,
`kapilya_visited`, `kapilya_theme`, and `kapilya_reduced_transparency`.

## Credentials and environment variables

### Where they go

| Where the app runs | Put them in |
| --- | --- |
| Your computer (`npm run dev`, `npm run start`, `npm run bot`) | `.env.local` in the project root (copy [.env.example](.env.example)) |
| Vercel | Project → **Settings → Environment Variables**, then redeploy |
| GitHub Action (data sync) | Nothing to add: it only reads the public directory and pushes with GitHub's built-in `GITHUB_TOKEN` |

`.env.local` and every other `.env*` file except `.env.example` are gitignored. **Never commit
real values**; this repository is public.

### Variables

| Variable | Needed for | Required? | Default |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram bot (`npm run bot`) and `/api/telegram/webhook` | Only for the bot | none (the bot exits without it) |
| `GOOGLE_MAPS_API_KEY` | Road distances from Google instead of OSRM, so they match Google Maps exactly | No | not set (uses OSRM) |
| `SYNC_TIMEZONE` | Time zone of the 6-hourly sync (12 AM, 6 AM, 12 PM, 6 PM) | No | `Asia/Manila` |
| `KAPILYA_AUTO_SYNC` | Set to `off` to stop a running server from syncing on its own | No | on |
| `KAPILYA_READ_ONLY` | Set to `1` to run as read-only (no writes, sync, or snapshots) on other serverless hosts | No | off (automatic on Vercel) |
| `OSRM_URL` | Your own OSRM routing server instead of the public one | No | `https://router.project-osrm.org` |

`NEXT_PUBLIC_APP_URL` may appear in older `.env.local` files; the app doesn't read it.

### Getting the credentials

- **Telegram bot token**: in Telegram, message [@BotFather](https://t.me/BotFather), use `/newbot`
  (or `/mybots` → your bot → **API Token**) and copy the token into `TELEGRAM_BOT_TOKEN`. If a token
  is ever exposed (pasted somewhere public or committed), revoke it right away with `/revoke` in
  BotFather and update `.env.local` and Vercel with the new one.
- **Google Maps API key** (optional): in [Google Cloud Console](https://console.cloud.google.com/),
  create or pick a project with billing, enable the **Distance Matrix API**, and create an API key.
  Restrict the key to the Distance Matrix API. It's only used on the server, never sent to
  browsers. Google charges per request beyond its free monthly allowance; distances are cached to
  keep usage low.

### Admin access

There are no user accounts or passwords. The **Settings** page (sync, snapshots, restore) has no
login: its menu button only appears on `localhost`, and elsewhere it opens with **Ctrl + .** on
desktop or **5 quick taps on the logo** on mobile. Anyone who knows the `/settings` address can open
it, which is why sync, snapshots, and restore are disabled on the read-only Vercel deployment. If
you host a writable server on the public internet, put `/settings`, `/api/ingest`, and
`/api/snapshots` behind your host's access protection.

## Telegram bot

`npm run bot` (long polling) and `/api/telegram/webhook` share the same replies
(`src/lib/bot-replies.ts`), read from the current data on every message: `/nearme`,
`/district <name> [gws|ext]`, or any chapel name. Congregation names link to directions.

Run only one of them per token: Telegram doesn't deliver updates by long polling while a webhook is
set for the bot.

## Distances

Distances are driving distances and times from the search point (e.g. "2.4 km · 4 min"), and
"Get directions" opens Google/Apple Maps from that same point in driving mode, so the numbers match
the route the map shows. Routing uses the public OSRM server (OpenStreetMap roads) by default; set
`GOOGLE_MAPS_API_KEY` to use Google's own routing, which matches Google Maps exactly. If routing is
unavailable, the straight-line distance is shown as "≈1.5 km".
