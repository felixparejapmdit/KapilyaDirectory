/**
 * Voice assistant engine (browser only): wake word "Hey Assistant", speech-to-text, text-to-speech.
 *
 * One continuous recognizer (the "ear") serves the wake word and commands, so nothing is lost switching
 * between them: "Hey Assistant, find the nearest local" works in one breath, and after "Hey Assistant"
 * the user can talk at once (no spoken greeting to wait for).
 *
 * - Mic vs. speaker: while the assistant talks, what the mic hears is never taken as a command (on
 *   laptops and phones it hears the assistant's own voice, transcribed late and imperfectly). The only
 *   thing that counts is the wake word, which interrupts the answer (the assistant never says it).
 *   When an answer ends the ear restarts with a clean transcript, dropping any late echo.
 * - iPhone/iPad: the ear is off while the assistant talks (with the mic open, iOS turns speech output
 *   down), and utterances end on our own silence timer because Safari rarely marks results final.
 *   Speech output needs one tap first (unlockSpeech). If Safari won't restart listening without a tap,
 *   `needsTap` is set so the UI can ask for one.
 * - The live input-level meter is desktop only: on phones a second microphone stream conflicts with
 *   speech recognition, so the orb pulses with recognised speech instead.
 * - Not offline: Chrome/Safari send audio to their speech service.
 */

export type VoicePhase = 'off' | 'armed' | 'greeting' | 'listening' | 'thinking' | 'speaking';

export interface VoiceState {
  enabled: boolean;
  phase: VoicePhase;
  interim: string;
  /** Live input level 0..1. */
  level: number;
  error: string | null;
  /** Listening stopped until the user taps (iPhone Safari). */
  needsTap: boolean;
}

export const WAKE_PATTERN = /\b(hey|hi|hay|ok|okay|a)\s+assist(ant|ance|ence)\b/i;
/** While the assistant talks, the user's words arrive mixed with its own: allow a word or two in between. */
const WAKE_OVER_SPEECH = /\b(hey|hi|hay|ok|okay)\b(?:\s+\S+){0,2}?\s+assist(ant|ance|ence)\b/i;
/** Shown (not spoken) when the assistant opens, so the user can talk right away. */
export const GREETING = 'Hi! How can I help?';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;
type ResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
const getSR = (): (new () => Recognition) | null =>
  typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
/* eslint-enable @typescript-eslint/no-explicit-any */

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const isMobile = () => isIOS() || (typeof navigator !== 'undefined' && /Android|Mobile/i.test(navigator.userAgent));

/**
 * When an utterance is over. Chrome marks results final itself (1-2 s after the user stops), so there
 * the silence timer is only a fallback and natural pauses don't cut a question short. Safari rarely
 * marks results final, so on iPhone the silence timer decides.
 */
const silenceMs = () => (isIOS() ? 1300 : 2200);
const FINAL_GRACE_MS = 350;

// Browsers don't say which voices are male, so go by the names they ship with (Windows/Edge, Chrome,
// macOS/iOS). Female names are ruled out first ("Female" also contains "male").
const MALE_VOICE = /\b(male|james|andrew|brian|guy|christopher|eric|roger|steffan|davis|jason|tony|david|mark|daniel|ryan|thomas|william|liam|aaron|arthur|evan|nathan|tom\b|alex\b|gordon|martin|rishi|reed|oliver|lee\b|george|matthew|joey|justin|russell)/i;
const FEMALE_VOICE = /female|samantha|victoria|karen|moira|tessa|fiona|zira|aria|jenny|michelle|emma|ava\b|libby|sonia|natasha|clara|rosa|susan|hazel|catherine|allison|nicky|serena|kate|alexandra|joanna|salli|kimberly|ivy|kendra|nicole|olivia|amy|siri/i;

/**
 * The assistant's voice: male, English, preferring Philippine English and natural/neural voices.
 * `male` is false when the device has no male English voice (the caller lowers the pitch instead).
 */
export function pickVoice(voices: SpeechSynthesisVoice[]): { voice: SpeechSynthesisVoice | null; male: boolean } {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    if (!/^en/i.test(v.lang)) continue;
    const male = !FEMALE_VOICE.test(v.name) && MALE_VOICE.test(v.name);
    const lang = v.lang.replace('_', '-').toLowerCase();
    const score =
      (male ? 100 : 0) +
      (/natural|neural|online|premium|enhanced/i.test(v.name) ? 20 : 0) +
      (lang === 'en-ph' ? 15 : lang === 'en-us' ? 10 : lang === 'en-gb' ? 8 : 5) +
      (/novelty|grandpa|rocko|junior|albert|ralph|bad news|bahh|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|organ|jester|superstar|wobble/i.test(v.name) ? -200 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return { voice: best, male: bestScore >= 100 };
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** The whole transcript of a recognition session. Android Chrome repeats earlier results inside later ones. */
function sessionTranscript(results: ResultList): { text: string; lastFinal: boolean } {
  let text = '';
  for (let i = 0; i < results.length; i++) {
    const t = results[i][0].transcript.trim();
    if (!t) continue;
    if (text && t.toLowerCase().startsWith(text.toLowerCase())) text = t;
    else text = text ? `${text} ${t}` : t;
  }
  return { text, lastFinal: results.length > 0 && results[results.length - 1].isFinal };
}

interface PendingListen {
  resolve: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Resolve with just the wake phrase as soon as it's heard (the rest carries over to the next listen). */
  stopAtWake: boolean;
  started: boolean;
  noSpeechTimer: number;
  maxTimer: number;
}

export class VoiceController {
  private state: VoiceState = { enabled: false, phase: 'off', interim: '', level: 0, error: null, needsTap: false };
  private subs = new Set<() => void>();

  // The ear: one continuous recognizer for the wake word and commands.
  private ear: Recognition = null;
  private earWanted = false;
  private earFailures = 0;
  private mode: 'wake' | 'command' = 'wake';
  /** Words of the current recognition session, and how many of them are already used. */
  private tokens: string[] = [];
  private lastFinal = false;
  private consumed = 0;
  private anchor = '';
  /** Words said right after the wake word belong to the next listen(). */
  private carryOver = false;
  /** "Hey Assistant" interrupted the assistant: the next listen() (or arm) starts over at once. */
  private wakeHeard = false;
  private pending: PendingListen | null = null;
  private endTimer = 0;

  // Speech out.
  private speaking = false;
  private speakingText = '';
  private stopSpeech: ((interrupted: boolean) => void) | null = null;

  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private raf = 0;
  private pulseTimer = 0;
  /** Called when the wake word is heard. */
  private onWake: (() => void) | null = null;
  /** Started automatically (not from the mic button): stay quiet about errors, retry after a tap. */
  private auto = false;
  private waitingForTap = false;
  setWakeHandler(fn: (() => void) | null) {
    this.onWake = fn;
  }

  getState = () => this.state;
  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };
  private set(patch: Partial<VoiceState>) {
    this.state = { ...this.state, ...patch };
    this.subs.forEach((fn) => fn());
  }

  /** Why voice can't work here, or null. */
  static unsupportedReason(): string | null {
    if (typeof window === 'undefined') return null;
    if (!window.isSecureContext) return 'Voice needs a secure (https) connection.';
    if (!getSR()) return 'Voice commands need Chrome, Edge, or Safari (with Siri & Dictation on, on iPhone).';
    return null;
  }

  /** Must be called from a tap/click (unlocks speech output on iOS). Returns false if voice is unavailable. */
  async enable(): Promise<boolean> {
    const reason = VoiceController.unsupportedReason();
    if (reason) {
      this.set({ error: reason });
      return false;
    }
    this.auto = false;
    this.waitingForTap = false;
    this.earFailures = 0;
    this.loadVoices();
    this.unlockSpeech();
    if (!this.stream && !isMobile() && navigator.mediaDevices?.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        this.startMeter(this.stream);
      } catch (err) {
        this.set({
          error:
            (err as DOMException)?.name === 'NotAllowedError'
              ? 'Microphone access is blocked. Allow it in your browser’s site settings.'
              : 'No microphone was found.',
        });
        return false;
      }
    }
    this.set({ enabled: true, error: null });
    this.arm();
    return true;
  }

  /**
   * Turns voice on when the app opens (no tap needed where the browser allows it). Browsers that
   * only start the microphone or speech after a user gesture (iPhone Safari) start on the first tap
   * anywhere. Errors are silent here; the menu-bar mic button reports them.
   */
  async autoStart(): Promise<void> {
    if (this.state.enabled || VoiceController.unsupportedReason()) return;
    this.auto = true;
    this.loadVoices();
    this.unlockOnFirstInteraction();
    if (!isMobile() && navigator.mediaDevices?.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        this.startMeter(this.stream);
      } catch {
        // Permission denied or no microphone: stay off until the user turns voice on.
        this.auto = false;
        return;
      }
    }
    this.set({ enabled: true, error: null });
    this.arm();
  }

  /** Speech output (and, on iOS, listening) may need a user gesture: start them on the next one. */
  private unlockOnFirstInteraction() {
    if (typeof document === 'undefined') return;
    const onFirst = () => {
      document.removeEventListener('pointerdown', onFirst, true);
      document.removeEventListener('keydown', onFirst, true);
      this.unlockSpeech();
      if (this.waitingForTap) {
        this.waitingForTap = false;
        this.earFailures = 0;
        this.set({ needsTap: false });
        if (this.state.enabled || this.pending) this.ensureEar(); // inside the gesture
      }
    };
    document.addEventListener('pointerdown', onFirst, true);
    document.addEventListener('keydown', onFirst, true);
  }

  disable() {
    this.cancel();
    this.stopEar();
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.audioCtx?.close();
    this.stream = null;
    this.audioCtx = null;
    this.set({ enabled: false, phase: 'off', interim: '', level: 0 });
  }

  /** Chrome fills the voice list in the background: ask early so the first reply uses the chosen voice. */
  private loadVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.getVoices();
      speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices(), { once: true });
    } catch {
      // ignore
    }
  }

  /** iOS only speaks after a user gesture: speak an empty utterance inside the tap. */
  unlockSpeech() {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(''));
      speechSynthesis.getVoices();
    } catch {
      // ignore
    }
  }

  private startMeter(stream: MediaStream) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new Ctx();
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 512;
    this.audioCtx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let last = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const s of samples) peak = Math.max(peak, Math.abs(s - 128));
      const level = Math.min(1, peak / 64);
      if (Math.abs(level - last) > 0.04) {
        last = level;
        this.set({ level });
      }
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Without a meter (phones), pulse the orb whenever speech is recognised. */
  private pulse() {
    if (this.stream) return;
    this.set({ level: 0.35 + Math.random() * 0.45 });
    window.clearTimeout(this.pulseTimer);
    this.pulseTimer = window.setTimeout(() => this.set({ level: 0 }), 260);
  }

  // ---------------- The ear ----------------

  /** Listen for "Hey Assistant" (when enabled). */
  arm() {
    this.mode = 'wake';
    if (this.wakeHeard && this.state.enabled && this.onWake) {
      // "Hey Assistant" interrupted an answer outside the voice panel (the Ask drawer): open the panel.
      this.wakeHeard = false;
      this.mode = 'command';
      this.onWake();
      return;
    }
    if (!this.state.enabled) {
      this.stopEar();
      this.set({ phase: 'off', interim: '' });
      return;
    }
    this.set({ phase: 'armed', interim: '' });
    this.ensureEar();
    this.process(); // "Hey Assistant" said over the last answer still counts
  }

  private ensureEar() {
    this.earWanted = true;
    if (!this.ear && !this.waitingForTap) this.startEar();
  }

  private stopEar() {
    this.earWanted = false;
    const rec = this.ear;
    this.ear = null;
    this.resetTranscript();
    try {
      rec?.abort();
    } catch {
      // ignore
    }
  }

  /** A fresh recognition session: drops anything still being transcribed (like the assistant's own voice). */
  private restartEar() {
    const wanted = this.earWanted;
    this.stopEar();
    if (wanted) this.ensureEar();
  }

  private resetTranscript() {
    this.tokens = [];
    this.lastFinal = false;
    this.consumed = 0;
    this.anchor = '';
    window.clearTimeout(this.endTimer);
  }

  private restartLater() {
    if (!this.earWanted) return;
    window.setTimeout(() => this.earWanted && !this.ear && !this.waitingForTap && this.startEar(), Math.min(250 * 2 ** this.earFailures, 8000));
  }

  /** Listening can't start without a tap (iPhone Safari): wait for one. */
  private needTap() {
    this.waitingForTap = true;
    this.set({ needsTap: true });
    this.unlockOnFirstInteraction();
    this.finishPending('');
  }

  private startEar() {
    const SR = getSR();
    if (!SR || !this.earWanted || this.ear) return;
    const rec: Recognition = new SR();
    this.ear = rec;
    this.resetTranscript();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: { results: ResultList }) => {
      if (this.ear !== rec) return;
      this.earFailures = 0;
      if (this.state.needsTap) this.set({ needsTap: false });
      const { text, lastFinal } = sessionTranscript(e.results);
      this.tokens = text.split(/\s+/).filter((w) => norm(w)); // no punctuation-only tokens
      this.lastFinal = lastFinal;
      this.realign();
      this.process();
    };
    rec.onerror = (e: { error: string }) => {
      if (this.ear !== rec) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.earWanted = false;
        if (this.auto || isIOS()) this.needTap();
        else {
          this.finishPending('');
          this.set({ error: 'Microphone or speech access is blocked. Allow it in your browser’s site settings.' });
        }
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        this.earFailures++;
      }
    };
    // Sessions end on silence, errors, or after a while (sooner on phones): keep it running.
    rec.onend = () => {
      if (this.ear !== rec) return;
      this.ear = null;
      if (this.pending) this.completeUtterance(); // a command cut off by the session ending still counts
      this.restartLater();
    };
    try {
      rec.start();
    } catch {
      this.ear = null;
      this.earFailures++;
      if (isIOS() && this.earFailures > 1) this.needTap();
      else if (this.auto && this.earFailures > 2) {
        this.earWanted = false;
        this.needTap();
      } else this.restartLater();
    }
  }

  /** Interim results get revised (words split or merged): keep `consumed` right after the words already used. */
  private realign() {
    if (!this.anchor) {
      this.consumed = Math.min(this.consumed, this.tokens.length);
      return;
    }
    const before = (i: number) => this.tokens.slice(Math.max(0, i - 2), i).map(norm).join(' ');
    if (this.consumed <= this.tokens.length && before(this.consumed) === this.anchor) return;
    for (const d of [1, -1, 2, -2, 3, -3]) {
      const i = this.consumed + d;
      if (i > 0 && i <= this.tokens.length && before(i) === this.anchor) {
        this.consumed = i;
        return;
      }
    }
    // The used words are gone: Safari started a fresh transcript without ending the session.
    if (this.consumed > this.tokens.length) {
      this.consumed = 0;
      this.anchor = '';
    }
  }

  private consumeUpTo(index = this.tokens.length) {
    this.consumed = index;
    this.anchor = this.tokens.slice(Math.max(0, index - 2), index).map(norm).join(' ');
    window.clearTimeout(this.endTimer);
  }

  /** Reacts to the latest transcript: wake word, live text, end of utterance. */
  private process() {
    const words = this.tokens.slice(this.consumed);
    if (!words.length) return;
    const joined = words.join(' ');
    const wake = WAKE_PATTERN.exec(joined);

    // While the assistant talks the mic mostly hears the assistant: only the wake word counts.
    if (this.speaking) {
      if (WAKE_OVER_SPEECH.test(joined) && !/assist/i.test(this.speakingText)) {
        this.wakeHeard = true;
        this.stopSpeech?.(true);
        this.restartEar(); // drop the mix of our voice and theirs; the next words start clean
        this.set({ phase: 'listening' });
      }
      return;
    }

    if (this.mode === 'wake') {
      if (wake && this.onWake) {
        this.consumeUpTo(this.consumed + wordCount(joined.slice(0, wake.index + wake[0].length)));
        this.mode = 'command';
        this.carryOver = true;
        this.onWake();
      } else if (this.lastFinal) this.consumeUpTo();
      else if (words.length > 12) this.consumeUpTo(this.tokens.length - 6);
      return;
    }

    this.pulse();
    const p = this.pending;
    if (!p) return; // picked up by the next listen()
    if (wake && p.stopAtWake) {
      // "Hey Assistant" again: start over now; whatever follows is the next question.
      this.consumeUpTo(this.consumed + wordCount(joined.slice(0, wake.index + wake[0].length)));
      this.carryOver = true;
      this.finishPending(wake[0]);
      return;
    }
    p.started = true;
    window.clearTimeout(p.noSpeechTimer);
    this.set({ interim: joined });
    p.onInterim?.(joined);
    window.clearTimeout(this.endTimer);
    this.endTimer = window.setTimeout(() => this.completeUtterance(), this.lastFinal ? FINAL_GRACE_MS : silenceMs());
  }

  private completeUtterance() {
    window.clearTimeout(this.endTimer);
    if (!this.pending) return;
    const text = this.tokens.slice(this.consumed).join(' ');
    if (!text) return;
    this.consumeUpTo();
    this.finishPending(text);
  }

  private finishPending(text: string) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    window.clearTimeout(p.noSpeechTimer);
    window.clearTimeout(p.maxTimer);
    window.clearTimeout(this.endTimer);
    this.set({ interim: '' });
    p.resolve(text.trim());
  }

  // ---------------- Speech in ----------------

  /**
   * Listens for one command and resolves with it ('' if nothing was said). Words said right after
   * the wake word count; anything older is dropped. `onInterim` receives the live transcript.
   * Call synchronously from a tap when possible (iOS).
   */
  listen(onInterim?: (text: string) => void, timeoutMs = 9000, { stopAtWake = false } = {}): Promise<string> {
    if (!getSR()) return Promise.resolve('');
    this.finishPending('');
    this.mode = 'command';
    if (this.wakeHeard) {
      this.wakeHeard = false;
      if (stopAtWake) {
        this.set({ phase: 'listening', interim: '' });
        return Promise.resolve('hey assistant');
      }
    }
    if (!this.carryOver) this.consumeUpTo();
    this.carryOver = false;
    this.set({ phase: 'listening', interim: '' });
    return new Promise((resolve) => {
      const p: PendingListen = { resolve, onInterim, stopAtWake, started: false, noSpeechTimer: 0, maxTimer: 0 };
      p.noSpeechTimer = window.setTimeout(() => this.pending === p && !p.started && this.finishPending(''), timeoutMs);
      p.maxTimer = window.setTimeout(() => {
        if (this.pending !== p) return;
        this.completeUtterance();
        if (this.pending === p) this.finishPending('');
      }, timeoutMs + 15000);
      this.pending = p;
      if (this.waitingForTap) {
        // Called from a tap: the gesture lets Safari start listening again.
        this.waitingForTap = false;
        this.earFailures = 0;
        this.set({ needsTap: false });
      }
      this.ensureEar();
      this.process();
    });
  }

  // ---------------- Speech out ----------------

  /** Speaks and resolves when done or interrupted (safety timeout: some browsers never fire onend). */
  speak(text: string, phase: VoicePhase = 'speaking', onProgress?: (charIndex: number) => void): Promise<void> {
    this.set({ phase });
    return new Promise((resolve) => {
      if (typeof speechSynthesis === 'undefined' || !text) return resolve();
      this.finishPending('');
      const wasListening = this.earWanted;
      if (isIOS()) this.stopEar(); // resumes with the next listen() or arm()
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const { voice, male } = pickVoice(speechSynthesis.getVoices());
      u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.pitch = male ? 1 : 0.8; // no male voice on this device: deepen the default one
      let done = false;
      const finish = (interrupted: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        if (this.stopSpeech === finish) this.stopSpeech = null;
        this.speaking = false;
        if (interrupted) {
          try {
            speechSynthesis.cancel();
          } catch {
            // ignore
          }
        } else if (!isIOS() && wasListening) {
          // Fresh transcript: the mic heard our own voice, and some of it is still being transcribed.
          this.restartEar();
        }
        onProgress?.(text.length);
        resolve();
      };
      const guard = setTimeout(() => finish(false), 2500 + text.length * 85);
      u.onend = () => finish(false);
      u.onerror = () => finish(false);
      if (onProgress) u.onboundary = (e) => onProgress(e.charIndex);
      this.stopSpeech = finish;
      this.speaking = true;
      this.speakingText = text;
      speechSynthesis.speak(u);
      this.process(); // "Hey Assistant" said while it was thinking interrupts at once
    });
  }

  /** Stop listening and speaking now. */
  cancel() {
    this.finishPending('');
    const finish = this.stopSpeech;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    finish?.(false);
    this.carryOver = false;
    this.wakeHeard = false;
    this.consumeUpTo(); // forget what was being said
  }

  setPhase(phase: VoicePhase) {
    this.set({ phase });
  }

  /** After a conversation: back to listening for the wake word (or off). */
  finishSession() {
    this.finishPending('');
    this.arm();
  }
}
