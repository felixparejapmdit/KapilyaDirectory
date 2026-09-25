/**
 * Runs the Telegram bot on Vercel (always on, no PC needed) instead of `npm run bot` on this PC.
 *
 *   npm run bot:webhook            connect Telegram to the deployed /api/telegram/webhook
 *   npm run bot:webhook -- status  show where Telegram currently delivers messages
 *   npm run bot:webhook -- off     disconnect (then `npm run bot` on this PC works again)
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local. The same two values must be set
 * in Vercel (Project → Settings → Environment Variables, Production) and deployed first; this script
 * checks that before connecting, so the bot never goes silent. TELEGRAM_WEBHOOK_URL overrides the
 * default address.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || 'https://kapilya-directory.vercel.app/api/telegram/webhook';
const action = process.argv[2] || 'on';

class Stop extends Error {}
/** Stops with a message (thrown rather than process.exit, so open connections close cleanly on Windows). */
function fail(message) {
  throw new Stop(message);
}

async function tg(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) fail(`Telegram ${method} failed: ${json.description}`);
  return json.result;
}

async function status() {
  const info = await tg('getWebhookInfo');
  if (!info.url) {
    console.log('Telegram delivers messages by polling: the bot only answers while `npm run bot` runs on a PC.');
    return;
  }
  console.log(`Telegram delivers messages to ${info.url} (always on).`);
  console.log(`Waiting to be delivered: ${info.pending_update_count}`);
  if (info.last_error_message) {
    console.log(`Last delivery error: ${info.last_error_message} (${new Date(info.last_error_date * 1000).toLocaleString()})`);
  }
}

async function connect() {
  if (!SECRET) fail('TELEGRAM_WEBHOOK_SECRET is missing from .env.local.');

  // 1. The deployment has both settings.
  let health;
  try {
    health = await (await fetch(WEBHOOK_URL, { cache: 'no-store' })).json();
  } catch (err) {
    fail(`Couldn't reach ${WEBHOOK_URL}: ${err.message}`);
  }
  if (!health?.configured || !health?.secured) {
    fail(
      `The deployment at ${new URL(WEBHOOK_URL).origin} doesn't have the bot settings yet.\n` +
        '  In Vercel: Project → Settings → Environment Variables, add TELEGRAM_BOT_TOKEN and\n' +
        '  TELEGRAM_WEBHOOK_SECRET (copy both from .env.local) for Production, then Deployments → Redeploy.'
    );
  }

  // 2. Its secret matches ours (an empty update is accepted and ignored; a wrong secret gets 401).
  const probe = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': SECRET },
    body: JSON.stringify({ update_id: 0 }),
  });
  if (probe.status === 401) {
    fail('TELEGRAM_WEBHOOK_SECRET in Vercel is different from .env.local. Make them the same and redeploy.');
  }
  if (!probe.ok) fail(`The webhook answered ${probe.status}. Check the deployment's logs in Vercel.`);

  // 3. Point Telegram at it.
  await tg('setWebhook', { url: WEBHOOK_URL, secret_token: SECRET, allowed_updates: ['message'] });
  await tg('setMyCommands', {
    commands: [
      { command: 'nearme', description: 'Find nearest chapel by GPS' },
      { command: 'district', description: 'Browse congregations in a district' },
      { command: 'subscribe', description: 'Subscribe to worship service reminders' },
      { command: 'help', description: 'Bot command guide and instructions' },
    ],
  });
  console.log('✔ The bot now runs on Vercel, around the clock. `npm run bot` on this PC is no longer needed.\n');
  await status();
}

try {
  if (!TOKEN) fail('TELEGRAM_BOT_TOKEN is missing from .env.local.');
  if (action === 'status') await status();
  else if (action === 'off') {
    await tg('deleteWebhook', { drop_pending_updates: false });
    console.log('Webhook removed. Run `npm run bot` on this PC to answer messages again.');
  } else await connect();
} catch (err) {
  if (!(err instanceof Stop)) throw err;
  console.error(`\n✖ ${err.message}\n`);
  process.exitCode = 1;
}
