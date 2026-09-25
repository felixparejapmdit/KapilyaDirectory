/**
 * Voice assistant engine (browser only): wake word "Hey Assistant", speech-to-text, text-to-speech.
 *
 * - Wake word: continuous Web Speech keyword spotting. Not offline: Chrome/Safari send audio to their
 *   speech service. For on-device detection, swap in Picovoice Porcupine (see prototypes/voice-assistant.html).
 * - Only one SpeechRecognition can run at a time, so the wake listener pauses during a command.
 * - iPhone/iPad: Safari only allows speech output after a tap (enable() unlocks it), and listening is
 *   most reliable when started from a tap (the drawer's mic button). The live input-level meter is
 *   skipped on iOS, where a second microphone stream conflicts with speech recognition.
 */

export type VoicePhase = 'off' | 'armed' | 'greeting' | 'listening' | 'thinking' | 'speaking';

export interface VoiceState {
  enabled: boolean;
  phase: VoicePhase;
  interim: string;
  /** Live input level 0..1 (0 when no meter, e.g. on iOS). */
  level: number;
  error: string | null;
}

export const WAKE_PATTERN = /\b(hey|hi|hay|ok|okay|a)\s+assist(ant|ance|ence)\b/i;
export const GREETING = "I am ready. You can say 'Find the nearest local', 'Get directions', or 'Check worship schedules'.";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;
const getSR = (): (new () => Recognition) | null =>
  typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
/* eslint-enable @typescript-eslint/no-explicit-any */

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export class VoiceController {
  private state: VoiceState = { enabled: false, phase: 'off', interim: '', level: 0, error: null };
  private subs = new Set<() => void>();
  private wakeRec: Recognition = null;
  private wakeActive = false;
  private wakeFailures = 0;
  private cmdRec: Recognition = null;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private raf = 0;
  /** Called when the wake word is heard. */
  private onWake: (() => void) | null = null;
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
    this.unlockSpeech();
    if (!isIOS() && navigator.mediaDevices?.getUserMedia) {
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

  disable() {
    this.stopWake();
    this.cancel();
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

  // ---------------- Wake word ----------------

  /** Listen for "Hey Assistant" (when enabled). */
  arm() {
    if (!this.state.enabled) {
      this.set({ phase: 'off', interim: '' });
      return;
    }
    this.set({ phase: 'armed', interim: '' });
    if (this.wakeActive) return;
    this.wakeActive = true;
    this.startWake();
  }

  private startWake() {
    const SR = getSR();
    if (!SR || !this.wakeActive) return;
    const rec: Recognition = new SR();
    this.wakeRec = rec;
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: { resultIndex: number; results: { 0: { transcript: string } }[] }) => {
      this.wakeFailures = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (WAKE_PATTERN.test(e.results[i][0].transcript)) {
          this.stopWake();
          this.onWake?.();
          return;
        }
      }
    };
    rec.onerror = (e: { error: string }) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.wakeActive = false;
        this.set({ error: 'Microphone or speech access is blocked. Allow it in your browser’s site settings.' });
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        this.wakeFailures++;
      }
    };
    // Sessions end on silence or after ~60 s (much sooner on iOS): restart while armed, backing off on errors.
    rec.onend = () => {
      if (this.wakeRec === rec) this.wakeRec = null;
      if (this.wakeActive) setTimeout(() => this.wakeActive && !this.wakeRec && this.startWake(), Math.min(300 * 2 ** this.wakeFailures, 10000));
    };
    try {
      rec.start();
    } catch {
      this.wakeFailures++;
    }
  }

  private stopWake() {
    this.wakeActive = false;
    const rec = this.wakeRec;
    this.wakeRec = null;
    try {
      rec?.abort();
    } catch {
      // ignore
    }
  }

  // ---------------- Speech out ----------------

  /** Speaks and resolves when done (safety timeout: some browsers never fire onend). */
  speak(text: string, phase: VoicePhase = 'speaking'): Promise<void> {
    this.set({ phase });
    return new Promise((resolve) => {
      if (typeof speechSynthesis === 'undefined' || !text) return resolve();
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
        resolve();
      };
      const guard = setTimeout(finish, 2500 + text.length * 85);
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
    });
  }

  // ---------------- Speech in ----------------

  /**
   * Listens for one command and resolves with the final transcript ('' if nothing was heard).
   * Call synchronously from a tap when possible (iOS). `onInterim` receives the live transcript.
   */
  listen(onInterim?: (text: string) => void, timeoutMs = 9000): Promise<string> {
    const SR = getSR();
    const wasArmed = this.wakeActive;
    this.stopWake();
    this.cancelListening();
    if (!SR) return Promise.resolve('');
    this.set({ phase: 'listening', interim: '' });

    return new Promise((resolve) => {
      let finalText = '';
      let interimText = '';
      let heard = false;
      let retried = false;
      let settled = false;
      const settle = (text: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.set({ interim: '' });
        resolve(text.trim());
      };
      const timer = setTimeout(() => this.cmdRec?.stop(), timeoutMs);

      const begin = () => {
        const rec: Recognition = new SR();
        this.cmdRec = rec;
        rec.lang = 'en-US';
        rec.continuous = false;
        rec.interimResults = true;
        rec.onresult = (e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => {
          heard = true;
          interimText = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
            else interimText += e.results[i][0].transcript;
          }
          const live = `${finalText} ${interimText}`.trim();
          this.set({ interim: live });
          onInterim?.(live);
        };
        rec.onerror = (e: { error: string }) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            this.set({ error: 'Microphone or speech access is blocked. Allow it in your browser’s site settings.' });
          }
          // The just-stopped wake listener can still hold the mic: retry once.
          if (!heard && !retried && (e.error === 'aborted' || e.error === 'audio-capture') && wasArmed) {
            retried = true;
            rec.onend = null;
            setTimeout(begin, 300);
          }
        };
        rec.onend = () => {
          if (this.cmdRec === rec) this.cmdRec = null;
          settle(finalText || interimText);
        };
        try {
          rec.start();
        } catch {
          if (!retried) {
            retried = true;
            setTimeout(begin, 300);
          } else settle('');
        }
      };
      begin();
    });
  }

  private cancelListening() {
    const rec = this.cmdRec;
    this.cmdRec = null;
    try {
      rec?.abort();
    } catch {
      // ignore
    }
  }

  /** Stop listening and speaking now. */
  cancel() {
    this.cancelListening();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  setPhase(phase: VoicePhase) {
    this.set({ phase });
  }

  /** After a command: back to listening for the wake word (or off). */
  finishSession() {
    this.arm();
  }
}
