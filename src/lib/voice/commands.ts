/**
 * Runs one spoken command (shared by the voice overlay and the Ask drawer's mic button).
 * Navigation intents drive the app directly; questions go to the Ask assistant (/api/ask).
 */
import type { LocaleKind } from '../types';
import { parseVoiceIntent, replyForSpeech, scheduleLines, type VoiceVocabulary } from './intents';

export interface AskContext {
  localeId?: string;
  language?: string;
}

export interface ResultCard {
  id: string;
  name: string;
  kind: LocaleKind;
  district?: string;
  distance: string;
  next: string;
  leave?: string;
  directions: string;
}

export interface CommandResult {
  /** Full reply for display (may contain [Name](/locales/id) links and URLs). */
  reply: string;
  /** Condensed version to speak. */
  say: string;
  /** Full weekly schedule from the reply, shown on screen instead of being read aloud. */
  schedule: { day: string; times: string }[];
  cards: ResultCard[];
  context?: AskContext;
  /** The conversation is over ("stop", "thank you") or the page changed behind it. */
  close?: boolean;
  isOffTopic?: boolean;
}

interface Env {
  location: { lat: number; lng: number; name: string };
  context: AskContext;
  navigate: (href: string) => void;
}

// Region/district names for voice commands, fetched once per page load.
let vocabPromise: Promise<VoiceVocabulary> | null = null;
export function loadVocabulary(): Promise<VoiceVocabulary> {
  vocabPromise ??= Promise.all([
    fetch('/api/regions').then((r) => r.json()),
    fetch('/api/districts').then((r) => r.json()),
  ])
    .then(([r, d]) => ({
      regions: (r.regions ?? []).map((x: { name: string }) => x.name),
      districts: (d.districts ?? []).map((x: { name: string; slug: string }) => ({ name: x.name, slug: x.slug })),
    }))
    .catch(() => {
      vocabPromise = null;
      return { regions: [], districts: [] };
    });
  return vocabPromise;
}

/** Asks the Ask assistant; returns its reply, result cards, and follow-up context. */
export async function askAssistant(
  message: string,
  env: Pick<Env, 'location' | 'context'>
): Promise<{ reply: string; cards: ResultCard[]; context?: AskContext; isOffTopic?: boolean }> {
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        lat: env.location.lat,
        lng: env.location.lng,
        locationName: env.location.name,
        context: env.context,
      }),
    });
    const data = await res.json();
    return {
      reply: data.reply || "I couldn't process that. Try asking about a specific chapel or district.",
      cards: data.cards ?? [],
      context: data.context,
      isOffTopic: data.isOffTopic,
    };
  } catch {
    return { reply: 'I couldn’t reach the directory. Please check your connection.', cards: [] };
  }
}

export async function executeVoiceCommand(text: string, env: Env): Promise<CommandResult> {
  const intent = parseVoiceIntent(text, await loadVocabulary());
  const kindParam = intent.kind ? `kind=${intent.kind.kind}` : '';
  const kindText = intent.kind ? `, ${intent.kind.label.toLowerCase()} only` : '';
  const navigated = (reply: string): CommandResult => ({ reply, say: reply, schedule: [], cards: [], close: true });

  switch (intent.type) {
    case 'STOP':
      return { reply: 'Okay.', say: 'Okay.', schedule: [], cards: [], close: true };

    case 'FILTER_REGION':
      env.navigate(`/districts?q=${encodeURIComponent(intent.region!)}${kindParam ? `&${kindParam}` : ''}`);
      return navigated(`Showing the ${intent.region} region on the Districts page${kindText}.`);

    case 'FILTER_DISTRICT':
      env.navigate(
        intent.kind
          ? `/districts?q=${encodeURIComponent(intent.district!.name)}&${kindParam}`
          : `/districts/${intent.district!.slug}`
      );
      return navigated(`Opening the ${intent.district!.name} district${kindText}.`);

    case 'FILTER_KIND':
      env.navigate(`/districts?${kindParam}`);
      return navigated(`Showing ${intent.kind!.label.toLowerCase()} on the Districts page.`);

    case 'FIND_NEAREST': {
      // Show them on the map as well as answering.
      env.navigate(`/near-me${kindParam ? `?${kindParam}` : ''}`);
      const a = await askAssistant(text, env);
      return { ...a, say: replyForSpeech(a.reply), schedule: scheduleLines(a.reply) };
    }

    default: {
      const a = await askAssistant(text, env);
      return { ...a, say: replyForSpeech(a.reply), schedule: scheduleLines(a.reply) };
    }
  }
}
