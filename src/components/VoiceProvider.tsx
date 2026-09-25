'use client';

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { VoiceController, type VoiceState } from '@/lib/voice/controller';

const OFF: VoiceState = { enabled: false, phase: 'off', interim: '', level: 0, error: null, needsTap: false };
/** Set to "off" when the user turns the assistant off with the menu-bar mic button. */
export const VOICE_PREF_KEY = 'kapilya_voice';

const VoiceContext = createContext<VoiceController | null>(null);

/**
 * One voice engine for the whole app (wake word, voice overlay, Ask drawer mic). It starts when the
 * app opens so "Hey Assistant" works right away, unless the user turned it off on this device.
 */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new VoiceController());

  useEffect(() => {
    let off = false;
    try {
      off = localStorage.getItem(VOICE_PREF_KEY) === 'off';
    } catch {
      // storage unavailable: default on
    }
    if (!off) void controller.autoStart();
    return () => controller.disable();
  }, [controller]);

  return <VoiceContext.Provider value={controller}>{children}</VoiceContext.Provider>;
}

export function useVoice(): { voice: VoiceController; state: VoiceState } {
  const voice = useContext(VoiceContext);
  if (!voice) throw new Error('useVoice must be used inside VoiceProvider');
  const state = useSyncExternalStore(voice.subscribe, voice.getState, () => OFF);
  return { voice, state };
}

/** Remember the user's on/off choice for the voice assistant on this device. */
export function setVoicePreference(on: boolean) {
  try {
    if (on) localStorage.removeItem(VOICE_PREF_KEY);
    else localStorage.setItem(VOICE_PREF_KEY, 'off');
  } catch {
    // ignore
  }
}
