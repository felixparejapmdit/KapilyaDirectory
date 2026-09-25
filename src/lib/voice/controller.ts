/**
 * Voice assistant engine (browser only): wake word "Hey Assistant", speech-to-text, text-to-speech.
 *
 * One continuous recognizer (the "ear") runs while voice is on and serves both the wake word and
 * commands, so nothing is lost switching between them: "Hey Assistant, find the nearest local" works
 * in one breath. An utterance ends after a short silence (our own timer: iPhone Safari rarely marks
 * results final), so answers start as soon as the user stops talking.
 *
 * - Barge-in: on desktop and Android the ear keeps listening while the assistant talks, so the user
 *   can interrupt with a new question or "Hey Assistant" and speech stops at once. The assistant's own
 *   voice coming back through the mic is recognised (it matches what is being said) and ignored.
 * - iPhone/iPad: the ear pauses while the assistant talks (with the mic open, iOS turns speech output
 *   down), and the greeting is shown instead of spoken so the user can talk right away. Speech output
 *   needs one tap first (unlockSpeech).
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
}

export const WAKE_PATTERN = /\b(hey|hi|hay|ok|okay|a)\s+assist(ant|ance|ence)\b/i;
/** Short on purpose: the user can start talking right away (and it never overlaps a command). */
export const GREETING = 'Hi! How can I help?';

const STOP_PATTERN = /\b(stop|cancel|quiet|never ?mind|tama na|tumigil)\b/i;
/** The utterance is over when the transcript stops changing for this long. */
const SILENCE_MS = 1100;
/** After a final result, wait this long in case more words follow. */
const FINAL_GRACE_MS = 450;
/** The assistant's own voice can still come back through the mic this long after it stops. */
const ECHO_TAIL_MS = 1800;

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
  started: boolean;
  noSpeechTimer: number;
  maxTimer: number;
}

export class VoiceController {
  private state: VoiceState = { enabled: false, phase: 'off', interim: '', level: 0, error: null };
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
  /** When the utterance in progress began, and whether the assistant was talking then. */
  private utterStart = 0;
  private utterDuringSpeech = false;
  /** Whether any of the utterance was heard while the assistant was talking (echo may be mixed in). */
  private utterOverlapsSpeech = false;
  private pending: PendingListen | null = null;
  private endTimer = 0;

  // Speech out (for barge-in and ignoring our own voice).
  private speaking = false;
  private echoWords = new Set<string>();
  private echoSeq: string[] = [];
  private echoUntil = 0;
  private stopSpeech: (() => void) | null = null;

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

  /** Whether the user can talk over the assistant (not on iPhone/iPad). */
  get hearsWhileSpeaking() {
    return !isIOS();
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

  /** Speech output (and, on iOS, listening) may need a user gesture: start them on the first one. */
  private unlockOnFirstInteraction() {
    if (typeof document === 'undefined') return;
    const onFirst = () => {
      document.removeEventListener('pointerdown', onFirst, true);
      document.removeEventListener('keydown', onFirst, true);
      this.unlockSpeech();
      if (this.waitingForTap && this.state.enabled) {
        this.waitingForTap = false;
        this.earFailures = 0;
        this.ensureEar(); // inside the gesture
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
    if (!this.ear) this.startEar();
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

  private resetTranscript() {
    this.tokens = [];
    this.lastFinal = false;
    this.consumed = 0;
    this.anchor = '';
    this.utterStart = 0;
  }

  private restartLater() {
    if (!this.earWanted) return;
    window.setTimeout(() => this.earWanted && !this.ear && this.startEar(), Math.min(250 * 2 ** this.earFailures, 8000));
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
        this.finishPending('');
        if (this.auto) {
          // Likely needs a tap first (iOS) or permission was dismissed: wait for an interaction.
          this.waitingForTap = true;
          this.unlockOnFirstInteraction();
        } else {
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
      if (this.auto && this.earFailures > 2) {
        this.earWanted = false;
        this.waitingForTap = true;
        this.unlockOnFirstInteraction();
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
    this.utterStart = 0;
    window.clearTimeout(this.endTimer);
  }

  /**
   * Removes the assistant's own voice mixed into the transcript. A word counts as echo when it
   * matches what is being said, in order with a nearby echo word (so one word the user happens to
   * share with the answer, like "Sunday", is kept).
   */
  private withoutEcho(words: string[]): string[] {
    const seq = this.echoSeq;
    if (!seq.length) return words;
    const positions = words.map((w) => {
      const n = norm(w);
      const at: number[] = [];
      if (n) seq.forEach((x, i) => x === n && at.push(i));
      return at;
    });
    const inOrder = (i: number, j: number) =>
      positions[i].some((p) => positions[j].some((q) => (j < i ? p - q > 0 && p - q <= 4 : q - p > 0 && q - p <= 4)));
    return words.filter((_, i) => {
      if (!positions[i].length) return true;
      for (let j = Math.max(0, i - 3); j <= Math.min(words.length - 1, i + 3); j++) {
        if (j !== i && positions[j].length && inOrder(i, j)) return false;
      }
      return true;
    });
  }

  /**
   * What the user is saying right now (after the words already used), or null if nothing, or if it
   * is only the assistant's own voice.
   */
  private currentCommand(): { text: string; wake: boolean } | null {
    const heard = this.tokens.slice(this.consumed);
    if (!heard.length) return null;
    const words = this.utterOverlapsSpeech ? this.withoutEcho(heard) : heard;
    if (!words.length) return null;
    const joined = words.join(' ');
    const wake = WAKE_PATTERN.exec(joined);
    if (wake) {
      // "…from you. Hey Assistant, …": everything before the wake phrase is noise.
      return { text: words.slice(wordCount(joined.slice(0, wake.index))).join(' '), wake: true };
    }
    if (this.utterDuringSpeech) {
      const novel = words.filter((w) => !this.echoWords.has(norm(w))).length;
      const isUser =
        (novel >= 1 && STOP_PATTERN.test(joined)) ||
        (words.length >= 2 && novel >= 1) ||
        (novel >= 1 && !this.speaking && novel / heard.length >= 0.5);
      if (!isUser) return null;
    }
    return { text: joined, wake: false };
  }

  /** Reacts to the latest transcript: wake word, barge-in, live text, end of utterance. */
  private process() {
    const words = this.tokens.slice(this.consumed);
    if (!words.length) return;

    if (this.mode === 'wake') {
      const joined = words.join(' ');
      const m = WAKE_PATTERN.exec(joined);
      if (m && this.onWake) {
        this.consumeUpTo(this.consumed + wordCount(joined.slice(0, m.index + m[0].length)));
        this.mode = 'command';
        this.onWake();
        this.process(); // anything said after the wake phrase starts the command
      } else if (this.lastFinal) this.consumeUpTo();
      else if (words.length > 12) this.consumeUpTo(this.tokens.length - 6);
      return;
    }

    const echoing = this.speaking || Date.now() < this.echoUntil;
    if (!this.utterStart) {
      this.utterStart = Date.now();
      this.utterDuringSpeech = echoing;
      this.utterOverlapsSpeech = false;
    }
    if (echoing) this.utterOverlapsSpeech = true;
    const cmd = this.currentCommand();
    if (!cmd || !cmd.text) {
      if (this.lastFinal) this.consumeUpTo(); // our own voice: forget it
      return;
    }
    if (this.speaking) this.bargeIn();
    this.pulse();
    const p = this.pending;
    if (!p) return; // picked up by the next listen()
    p.started = true;
    window.clearTimeout(p.noSpeechTimer);
    // Live text: hide words that may still turn out to be our own voice.
    const live = this.utterOverlapsSpeech ? cmd.text.split(' ').filter((w) => !this.echoWords.has(norm(w))).join(' ') || cmd.text : cmd.text;
    this.set({ interim: live });
    p.onInterim?.(live);
    window.clearTimeout(this.endTimer);
    this.endTimer = window.setTimeout(() => this.completeUtterance(), this.lastFinal ? FINAL_GRACE_MS : SILENCE_MS);
  }

  private completeUtterance() {
    window.clearTimeout(this.endTimer);
    if (!this.pending) return;
    const cmd = this.currentCommand();
    if (!cmd || !cmd.text) return;
    this.consumeUpTo();
    this.finishPending(cmd.text);
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
   * Listens for one command and resolves with it ('' if nothing was said). Words already said (right
   * after the wake word, or over the assistant's voice) count. `onInterim` receives the live transcript.
   * Call synchronously from a tap when possible (iOS).
   */
  listen(onInterim?: (text: string) => void, timeoutMs = 9000): Promise<string> {
    if (!getSR()) return Promise.resolve('');
    this.finishPending('');
    this.mode = 'command';
    this.set({ phase: 'listening', interim: '' });
    return new Promise((resolve) => {
      const p: PendingListen = { resolve, onInterim, started: false, noSpeechTimer: 0, maxTimer: 0 };
      p.noSpeechTimer = window.setTimeout(() => this.pending === p && !p.started && this.finishPending(''), timeoutMs);
      p.maxTimer = window.setTimeout(() => {
        if (this.pending !== p) return;
        this.completeUtterance();
        if (this.pending === p) this.finishPending('');
      }, timeoutMs + 15000);
      this.pending = p;
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
      if (this.hearsWhileSpeaking) {
        if (this.earWanted) this.mode = 'command'; // so the user can interrupt
      } else {
        this.stopEar(); // iOS: resumes with the next listen() or arm()
      }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      const voices = speechSynthesis.getVoices();
      u.voice =
        voices.find((v) => v.lang === 'en-PH') ||
        voices.find((v) => v.lang === 'en-US' && /natural|google|samantha|siri/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        if (this.stopSpeech === finish) this.stopSpeech = null;
        this.speaking = false;
        this.echoUntil = Date.now() + ECHO_TAIL_MS;
        // Whatever of our own voice is still being transcribed after the tail is dropped.
        window.setTimeout(() => {
          if (!this.speaking && this.utterStart && this.utterDuringSpeech && !this.currentCommand()) this.consumeUpTo();
        }, ECHO_TAIL_MS);
        onProgress?.(text.length);
        resolve();
      };
      const guard = setTimeout(finish, 2500 + text.length * 85);
      u.onend = finish;
      u.onerror = finish;
      if (onProgress) u.onboundary = (e) => onProgress(e.charIndex);
      this.stopSpeech = finish;
      this.speaking = true;
      this.echoSeq = text.split(/\s+/).map(norm).filter(Boolean);
      this.echoWords = new Set(this.echoSeq);
      speechSynthesis.speak(u);
      if (this.utterStart) this.utterOverlapsSpeech = true;
      this.process(); // "Hey Assistant" said just before we started talking interrupts at once
    });
  }

  /** The user started talking over the assistant: stop speaking now. */
  private bargeIn() {
    const finish = this.stopSpeech;
    try {
      speechSynthesis.cancel();
    } catch {
      // ignore
    }
    finish?.(); // don't wait for onend, which some browsers fire late after cancel()
    this.set({ phase: 'listening' });
  }

  /** Stop listening and speaking now. */
  cancel() {
    this.finishPending('');
    const finish = this.stopSpeech;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    finish?.();
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
