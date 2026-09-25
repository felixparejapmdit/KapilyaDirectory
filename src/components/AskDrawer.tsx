'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Mic, Square } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserLocation } from '@/components/LocationProvider';
import { useVoice } from '@/components/VoiceProvider';
import { GREETING, WAKE_PATTERN } from '@/lib/voice/controller';
import { askAssistant, executeVoiceCommand } from '@/lib/voice/commands';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  isOffTopic?: boolean;
}

interface AskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  greeting: 'Speaking…',
  listening: 'Listening…',
  thinking: 'Working on it…',
  speaking: 'Speaking…',
  armed: 'Say “Hey Assistant” or tap the mic',
};

export function AskDrawer({ isOpen, onClose }: AskDrawerProps) {
  const router = useRouter();
  const { location } = useUserLocation();
  const { voice, state: voiceState } = useVoice();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am your Kapilya Near Me assistant. I can help you find nearby congregations, check worship service times (e.g. Thursday or Sunday), and get travel directions. Type, tap the mic, or say “Hey Assistant”.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // What the last answer was about (congregation, language), so follow-ups like "What about Sunday?" resolve.
  const [context, setContext] = useState<{ localeId?: string; language?: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef(context);
  const sessionRef = useRef(0);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (voiceState.phase === 'off' || voiceState.phase === 'armed') inputRef.current?.focus();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isOpen]);

  const addMessage = (m: Omit<Message, 'id'>) =>
    setMessages((prev) => [...prev, { ...m, id: `${m.sender}-${prev.length}-${m.text.length}` }]);

  /** Sends a question to the Ask assistant, shows the reply, and returns it. */
  const ask = useCallback(
    async (query: string): Promise<string> => {
      setLoading(true);
      try {
        const a = await askAssistant(query, { location, context: contextRef.current });
        if (a.context) setContext(a.context);
        addMessage({ sender: 'assistant', text: a.reply, isOffTopic: a.isOffTopic });
        return a.reply;
      } finally {
        setLoading(false);
      }
    },
    [location]
  );

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;
    addMessage({ sender: 'user', text: query });
    if (!textToSend) setInput('');
    await ask(query);
  };

  /** Voice commands (drawer mic): same behaviour as the voice overlay, answers shown in the chat. */
  const runVoiceCommand = useCallback(
    async (text: string): Promise<{ say: string; close?: boolean }> => {
      setLoading(true);
      try {
        const r = await executeVoiceCommand(text, {
          location,
          context: contextRef.current,
          navigate: (href) => router.push(href),
        });
        if (r.context) setContext(r.context);
        addMessage({ sender: 'assistant', text: r.reply, isOffTopic: r.isOffTopic });
        return { say: r.say, close: r.close };
      } finally {
        setLoading(false);
      }
    },
    [location, router]
  );

  /** One spoken exchange: (greeting) → listen with live transcript → act → answer out loud. */
  const runVoiceSession = useCallback(
    async (greet: boolean) => {
      const session = ++sessionRef.current;
      const alive = () => sessionRef.current === session;
      if (greet) {
        if (voice.hearsWhileSpeaking) await voice.speak(GREETING, 'greeting');
        if (!alive()) return;
      }
      const heard = await voice.listen((live) => alive() && setInput(live));
      if (!alive()) return;
      // "Hey Assistant, …" here just means the question that follows.
      const wake = WAKE_PATTERN.exec(heard);
      const text = wake ? heard.slice(wake.index + wake[0].length).replace(/^[\s,.!?]+/, '').trim() : heard;
      setInput('');
      if (!text) {
        await voice.speak("I didn't catch that. Tap the mic and try again.");
        if (alive()) voice.finishSession();
        return;
      }
      addMessage({ sender: 'user', text });
      voice.setPhase('thinking');
      const { say, close } = await runVoiceCommand(text);
      if (!alive()) return;
      await voice.speak(say);
      if (!alive()) return;
      voice.finishSession();
      if (close) onClose();
    },
    [voice, runVoiceCommand, onClose]
  );

  const voiceBusy = ['greeting', 'listening', 'thinking', 'speaking'].includes(voiceState.phase);

  // Mic button: tap to talk (starts inside the tap, which iPhone requires), tap again to stop.
  const onMicTap = () => {
    if (voiceBusy) {
      sessionRef.current++;
      voice.cancel();
      voice.finishSession();
      setInput('');
      return;
    }
    voice.unlockSpeech();
    void runVoiceSession(false);
  };

  const close = () => {
    if (voiceBusy) {
      sessionRef.current++;
      voice.cancel();
      voice.finishSession();
    }
    onClose();
  };

  if (!isOpen) return null;

  const samplePrompts = [
    'Is there an English service nearby?',
    'Directions to the nearest one',
    'What about Sunday?',
  ];

  return (
    <div className="fixed inset-0 z-[2000] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={close}
      />

      {/* Drawer Panel — original dark glass design */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="kd-drawer-in w-screen max-w-md glass-panel !rounded-none !border-r-0 !border-y-0 border-l border-white/20 flex flex-col bg-[#0B1426]/90 shadow-2xl">

          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8A33D]/20 text-[#E8A33D] flex items-center justify-center border border-[#E8A33D]/40">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base leading-tight">Kapilya Near Me AI Assistant</h3>
                <span className="text-xs text-[#A9B4C2]">Schedules, directions &amp; districts, by text or voice</span>
              </div>
            </div>
            <button
              onClick={close}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close Ask Drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Voice panel: pulsing mic, what the assistant is doing, live transcript */}
          {voiceBusy && (
            <div className="px-4 py-4 border-b border-white/10 bg-[#E8A33D]/[0.04] flex items-center gap-4" aria-live="polite">
              <button
                type="button"
                onClick={onMicTap}
                aria-label="Stop voice"
                className={`kd-mic-orb shrink-0 ${voiceState.phase === 'listening' ? 'is-listening' : 'is-speaking'}`}
                style={{ '--level': voiceState.level } as React.CSSProperties}
              >
                <span className="kd-mic-pulse" />
                <span className="kd-mic-pulse kd-mic-pulse--late" />
                <span className="kd-mic-ring" />
                <span className="kd-mic-core">
                  <Mic size={22} />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#E8A33D]">{PHASE_LABEL[voiceState.phase]}</p>
                <p className="text-sm text-white/90 leading-snug line-clamp-3">
                  {voiceState.phase === 'greeting'
                    ? GREETING
                    : voiceState.phase === 'listening'
                      ? voiceState.interim || 'Go ahead, I’m listening.'
                      : voiceState.phase === 'thinking'
                        ? 'Checking the directory…'
                        : 'Tap the mic to stop.'}
                </p>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender === 'user'
                      ? 'bg-[#E8A33D] text-[#0B1426] font-medium'
                      : m.isOffTopic
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                      : 'bg-white/10 text-gray-100 border border-white/10'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed break-words">
                    {m.text.split(/(\[[^\]]+\]\(\/[^)\s]+\)|https?:\/\/\S+)/g).map((part, i) => {
                      // [Name](/locales/id): the congregation's details page.
                      const internal = part.match(/^\[([^\]]+)\]\((\/[^)\s]+)\)$/);
                      if (internal) {
                        return (
                          <Link
                            key={i}
                            href={internal[2]}
                            onClick={close}
                            className={`font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid ${
                              m.sender === 'user' ? '' : 'text-[#E8A33D] hover:text-[#F3B353]'
                            }`}
                          >
                            {internal[1]}
                          </Link>
                        );
                      }
                      if (/^https?:\/\//.test(part)) {
                        return (
                          <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#E8A33D] underline underline-offset-2"
                          >
                            {part.includes('maps') ? 'Open in Maps ↗' : part}
                          </a>
                        );
                      }
                      return <React.Fragment key={i}>{part}</React.Fragment>;
                    })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-[#A9B4C2] p-2">
                <div className="w-2 h-2 rounded-full bg-[#E8A33D] animate-ping" />
                <span>Checking directory and schedules...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-white/5 bg-black/20">
            {samplePrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[#A9B4C2] hover:text-white border border-white/10 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-4 border-t border-white/10 bg-[#0B1426]/95">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                readOnly={voiceState.phase === 'listening'}
                placeholder={voiceState.phase === 'listening' ? 'Listening…' : 'Ask about a chapel, schedule, or directions...'}
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#E8A33D] transition-colors"
              />
              <button
                type="button"
                onClick={onMicTap}
                aria-label={voiceBusy ? 'Stop voice' : 'Speak a question'}
                title={voiceBusy ? 'Stop' : 'Speak'}
                className={`!p-2.5 rounded-lg border transition-colors ${
                  voiceBusy
                    ? 'border-[#E8A33D] bg-[#E8A33D]/20 text-[#E8A33D]'
                    : 'border-white/15 bg-white/5 text-[#A9B4C2] hover:text-white hover:bg-white/10'
                }`}
              >
                {voiceBusy ? <Square size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || loading || voiceState.phase === 'listening'}
                className="btn-amber !p-2.5 rounded-lg disabled:opacity-40"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
