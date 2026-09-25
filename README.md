# Kapilya Directory

A near-me finder for Iglesia Ni Cristo local congregations, extensions, and group worship services
worldwide: worship schedules in a departure-board layout, a map of nearby chapels, directions, an Ask
assistant, and a Telegram bot. Built with Next.js (App Router), Tailwind CSS, and Leaflet.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in TELEGRAM_BOT_TOKEN (only needed for the bot)
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm run start -- -p 3000
npm run bot                  # optional: Telegram bot (long polling), reads .env.local
```

## Directory data

All data lives in `data/store.json`: 198 districts and every locale with its name, type, address,
coordinates, contacts, and worship schedule, taken from the official directory at
[iglesianicristo.net/directory](https://iglesianicristo.net/directory).

It stays current in three ways:

- **Every 6 hours** (12 AM, 6 AM, 12 PM, 6 PM in `SYNC_TIMEZONE`, default `Asia/Manila`):
  - a running server syncs itself (set `KAPILYA_AUTO_SYNC=off` to disable);
  - the GitHub Action in `.github/workflows/sync-directory.yml` syncs, commits `data/store.json`
    when anything changed, and the push redeploys the site (e.g. Vercel, which is read-only).
- **Settings → Run Sync Now**: starts the same sync on demand and shows its progress.
  (The Settings button appears in the menu on localhost. Anywhere else, open the page with **Ctrl + .** on desktop, or tap the logo **5 times quickly** on mobile.)
- **CLI**: `npm run sync:directory` (add `--dry-run` to preview, `--only=slug1,slug2` for a few locales).

A full sync fetches every locale page (about 8,800) at a gentle rate and takes 30 to 90 minutes.
A sync that finds no changes leaves `store.json` untouched.
Before any change is written, the current store is saved to `data/snapshots/`, and you can restore
it from Settings. Locales the source can't be reached for keep their previous data.

## Environment

See [.env.example](.env.example). `.env.local` is gitignored; never commit the bot token.

## Telegram bot

`npm run bot` (long polling) and `/api/telegram/webhook` share the same replies
(`src/lib/bot-replies.ts`), read from the current data on every message: `/nearme`,
`/district <name> [gws|ext]`, or any chapel name. Congregation names link to directions.

If you run a local server and also pull the Action's data commits, discard local sync results first
(`git checkout data/store.json`), or set `KAPILYA_AUTO_SYNC=off` locally.

## Distances

Distances are driving distances and times from the search point (e.g. "2.4 km · 4 min"), and
"Get directions" opens Google/Apple Maps from that same point in driving mode, so the numbers match
the route the map shows. Routing uses the public OSRM server (OpenStreetMap roads) by default; set
`GOOGLE_MAPS_API_KEY` (Distance Matrix API) to use Google's own routing, which matches Google Maps
exactly. If routing is unavailable, the straight-line distance is shown as "≈1.5 km".
