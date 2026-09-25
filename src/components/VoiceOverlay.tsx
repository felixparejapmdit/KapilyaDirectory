'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Navigation as NavIcon, X } from 'lucide-react';
import { useVoice } from './VoiceProvider';
import { useUserLocation } from './LocationProvider';
import { GREETING, WAKE_PATTERN } from '@/lib/voice/controller';
import { executeVoiceCommand, type AskContext, type ResultCard } from '@/lib/voice/commands';

/** Follow-up turns after the first answer before the assistant goes back to sleep. */
const MAX_TURNS = 4;
const SUGGESTIONS = ['Find the nearest local', 'Get directions', 'Check worship schedules', 'What’s the soonest service?'];

const KIND_TAG: Record<ResultCard['kind'], string | null> = {
  local_congregation: null,
  extension: 'Ext',
  group_worship_service: 'GWS',
};

/**
 * Siri-style voice assistant: pops up on "Hey Assistant", greets, listens, answers out loud with
 * result cards, then keeps listening for a follow-up so it feels like a conversation. Separate
 * from the Ask drawer (which has its own mic button).
 */
export function VoiceOverlay({ open, trigger, onClose }: { open: boolean; trigger: number; onClose: () => void }) {
  const router = useRouter();
  const { location } = useUserLocation();
  const { voice, state } = useVoice();
  const [userText, setUserText] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [revealed, setRevealed] = useState(0);
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [schedule, setSchedule] = useState<{ day: string; times: string }[]>([]);
  const [closing, setClosing] = useState(false);
  /** Bumped on every fresh start: re-mounts the panel so it pops in again, scrolled to the top. */
  const [round, setRound] = useState(0);
  const sessionRef = useRef(0);
  const contextRef = useRef<AskContext>({});
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  /** Clears the panel back to a fresh start (used on every "Hey Assistant"). */
  const reset = useCallback(() => {
    setRound((r) => r + 1);
    setClosing(false);
    setUserText('');
    setAssistantText('');
    setRevealed(0);
    setSchedule([]);
    setCards([]);
    contextRef.current = {};
    bodyRef.current?.scrollTo({ top: 0 });
  }, []);
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  /** Speaks while revealing the text word by word (all at once if the browser has no word events). */
  const say = useCallback(
    async (text: string, phase: 'greeting' | 'speaking', alive: () => boolean) => {
      setAssistantText(text);
      setRevealed(0);
      let progressed = false;
      const fallback = window.setTimeout(() => !progressed && alive() && setRevealed(text.length), 700);
      await voice.speak(text, phase, (i) => {
        progressed = true;
        if (!alive()) return;
        const nextSpace = text.indexOf(' ', i + 1);
        setRevealed(nextSpace === -1 ? text.length : nextSpace);
      });
      window.clearTimeout(fallback);
      if (alive()) setRevealed(text.length);
    },
    [voice]
  );

  /** Greets on screen at once. Spoken only where the user can talk over it (not iPhone), so they never wait. */
  const showGreeting = useCallback(
    async (alive: () => boolean) => {
      if (voice.hearsWhileSpeaking) return say(GREETING, 'greeting', alive);
      setAssistantText(GREETING);
      setRevealed(GREETING.length);
    },
    [say, voice]
  );

  const dismiss = useCallback(() => {
    const session = ++sessionRef.current;
    voice.cancel();
    voice.finishSession();
    setClosing(true);
    window.setTimeout(() => {
      // A new "Hey Assistant" during the closing animation keeps the panel open.
      if (sessionRef.current !== session) return;
      setClosing(false);
      onClose();
    }, 260);
  }, [voice, onClose]);

  /** Handles one utterance (spoken or a tapped suggestion); returns false when the conversation should end. */
  const handle = useCallback(
    async (text: string, alive: () => boolean): Promise<boolean> => {
      setUserText(text);
      setCards([]);
      setSchedule([]);
      setAssistantText('');
      scrollToTop();
      voice.setPhase('thinking');
      const result = await executeVoiceCommand(text, {
        location: locationRef.current,
        context: contextRef.current,
        navigate: (href) => router.push(href),
      });
      if (!alive()) return false;
      if (result.context) contextRef.current = result.context;
      setCards(result.cards.slice(0, 5));
      setSchedule(result.schedule);
      await say(result.say, 'speaking', alive);
      return alive() && !result.close;
    },
    [router, say, voice]
  );

  /** Greet → listen → answer → listen again for a follow-up, until silence, "stop", or MAX_TURNS. */
  const converse = useCallback(
    async (fresh: boolean, firstText?: string) => {
      const session = ++sessionRef.current;
      const alive = () => sessionRef.current === session;
      if (fresh) reset();
      else {
        setUserText('');
        setCards([]);
        setSchedule([]);
        scrollToTop();
      }
      if (firstText) {
        if (!(await handle(firstText, alive))) return alive() && dismiss();
      } else if (fresh) {
        await showGreeting(alive);
        if (!alive()) return;
      }
      for (let turn = firstText ? 1 : 0; turn < MAX_TURNS && alive(); turn++) {
        const heard = await voice.listen((live) => alive() && setUserText(live), turn === 0 ? 9000 : 7000);
        if (!alive()) return;
        if (!heard) {
          if (turn === 0 && !firstText) await say("I didn't catch that. Tap the orb and try again.", 'speaking', alive);
          break;
        }
        // "Hey Assistant" mid-conversation starts over from the top; anything said after it is the new question.
        const wake = WAKE_PATTERN.exec(heard);
        if (wake) {
          const rest = heard.slice(wake.index + wake[0].length).replace(/^[\s,.!?]+/, '').trim();
          reset();
          if (!rest) {
            await showGreeting(alive);
            if (!alive()) return;
            turn = -1;
            continue;
          }
          if (!(await handle(rest, alive))) break;
          continue;
        }
        if (!(await handle(heard, alive))) break;
      }
      if (alive()) window.setTimeout(() => alive() && dismiss(), 900);
    },
    [dismiss, handle, reset, say, showGreeting, voice]
  );

  // "Hey Assistant" (trigger increments): start a conversation.
  const lastTrigger = useRef(trigger);
  useEffect(() => {
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    contextRef.current = {};
    void converse(true);
  }, [trigger, converse]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  if (!open) return null;

  const phase = state.phase;
  const busy = phase === 'greeting' || phase === 'listening' || phase === 'thinking' || phase === 'speaking';
  const status =
    phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'Thinking…' : phase === 'greeting' || phase === 'speaking' ? 'Speaking…' : 'Tap to talk';

  // Tap the orb: talk now (starts inside the tap, which iPhone needs), or stop.
  const onOrb = () => {
    if (phase === 'listening' || phase === 'speaking' || phase === 'greeting') {
      sessionRef.current++;
      voice.cancel();
      voice.finishSession();
      return;
    }
    voice.unlockSpeech();
    void converse(false);
  };

  const openLocale = (id: string) => {
    router.push(`/locales/${id}`);
    dismiss();
  };

  // Portal to <body> so no page layout (maps, sticky headers, transforms) can cover it.
  return createPortal(
    <div className={`kd-voice ${closing ? 'is-closing' : ''}`} data-phase={phase}>
      <div className="kd-voice-edge" style={{ '--level': state.level } as React.CSSProperties} aria-hidden />
      <div className="kd-voice-scrim" onClick={dismiss} aria-hidden />

      <section key={round} role="dialog" aria-label="Voice assistant" className="kd-voice-panel">
        <button type="button" onClick={dismiss} className="kd-voice-close" aria-label="Close voice assistant">
          <X size={18} />
        </button>

        <div ref={bodyRef} className="kd-voice-body" aria-live="polite">
          {userText ? (
            <p className="kd-voice-user">{userText}</p>
          ) : (
            <p className="kd-voice-hint">{phase === 'listening' ? 'Go ahead, I’m listening…' : 'Kapilya Near Me AI Assistant'}</p>
          )}

          {assistantText && (
            <p className="kd-voice-reply">
              <span>{assistantText.slice(0, revealed)}</span>
              <span className="kd-voice-reply-pending">{assistantText.slice(revealed)}</span>
            </p>
          )}

          {schedule.length > 0 && (
            <dl className="kd-voice-schedule">
              {schedule.map((row, i) => (
                <div key={row.day} style={{ animationDelay: `${i * 50}ms` }}>
                  <dt>{row.day}</dt>
                  <dd>{row.times}</dd>
                </div>
              ))}
            </dl>
          )}

          {cards.length > 0 && (
            <div className="kd-voice-cards">
              {cards.map((c, i) => (
                <div key={c.id} className="kd-voice-card" style={{ animationDelay: `${i * 70}ms` }}>
                  <button type="button" onClick={() => openLocale(c.id)} className="kd-voice-card-main">
                    <span className="kd-voice-card-name">
                      {c.name}
                      {KIND_TAG[c.kind] && <span className="kd-voice-card-tag">{KIND_TAG[c.kind]}</span>}
                    </span>
                    <span className="kd-voice-card-meta">{c.distance}{c.district ? ` · ${c.district}` : ''}</span>
                    <span className="kd-voice-card-next">
                      {c.leave ? `${c.next} · ${c.leave}` : `Next: ${c.next}`}
                    </span>
                  </button>
                  <a href={c.directions} target="_blank" rel="noopener noreferrer" className="kd-voice-card-dir">
                    <NavIcon size={13} /> Directions
                  </a>
                </div>
              ))}
            </div>
          )}

          {!userText && !cards.length && (phase === 'greeting' || phase === 'listening' || phase === 'armed' || phase === 'off') && (
            <div className="kd-voice-chips">
              {SUGGESTIONS.map((sgt) => (
                <button
                  key={sgt}
                  type="button"
                  onClick={() => {
                    voice.cancel();
                    void converse(false, sgt);
                  }}
                >
                  {sgt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="kd-voice-footer">
          <button
            type="button"
            onClick={onOrb}
            className="kd-siri-orb"
            style={{ '--level': state.level } as React.CSSProperties}
            aria-label={busy ? 'Stop' : 'Talk'}
          >
            <span className="kd-siri-blob b1" />
            <span className="kd-siri-blob b2" />
            <span className="kd-siri-blob b3" />
            <span className="kd-siri-blob b4" />
            <span className="kd-siri-gloss" />
          </button>
          <p className="kd-voice-status">{status}</p>
        </div>
      </section>
    </div>,
    document.body
  );
}
