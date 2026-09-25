'use client';

import React, { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { VoiceController, type VoiceState } from '@/lib/voice/controller';

const OFF: VoiceState = { enabled: false, phase: 'off', interim: '', level: 0, error: null };

const VoiceContext = createContext<VoiceController | null>(null);

/** One voice engine for the whole app (menu-bar toggle, wake word, Ask drawer). */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() => new VoiceController());
  return <VoiceContext.Provider value={controller}>{children}</VoiceContext.Provider>;
}

export function useVoice(): { voice: VoiceController; state: VoiceState } {
  const voice = useContext(VoiceContext);
  if (!voice) throw new Error('useVoice must be used inside VoiceProvider');
  const state = useSyncExternalStore(voice.subscribe, voice.getState, () => OFF);
  return { voice, state };
}
