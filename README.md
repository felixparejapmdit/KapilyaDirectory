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

- **Nightly**: the running server syncs automatically at 12:00 AM (`SYNC_TIMEZONE`, default
  `Asia/Manila`). Set `KAPILYA_NIGHTLY_SYNC=off` to disable.
- **Settings → Run Sync Now**: starts the same sync on demand and shows its progress.
  (The Settings link only appears in the menu when the app is opened on localhost; the page itself is at `/settings`.)
- **CLI**: `npm run sync:directory` (add `--dry-run` to preview, `--only=slug1,slug2` for a few locales).

A full sync fetches every locale page (about 8,800) at a gentle rate and takes roughly 30 minutes.
Before any change is written, the current store is saved to `data/snapshots/`, and you can restore
it from Settings. Locales the source can't be reached for keep their previous data.

## Environment

See [.env.example](.env.example). `.env.local` is gitignored; never commit the bot token.
