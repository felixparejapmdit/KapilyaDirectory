'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useUserLocation } from '@/components/LocationProvider';

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

export function AskDrawer({ isOpen, onClose }: AskDrawerProps) {
  const { location } = useUserLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am your scoped Kapilya Near Me assistant. I can help you find nearby congregations, check worship service times (e.g. Thursday or Sunday), and get travel directions.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // What the last answer was about (congregation, language), so follow-ups like "What about Sunday?" resolve.
  const [context, setContext] = useState<{ localeId?: string; language?: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          lat: location.lat,
          lng: location.lng,
          locationName: location.name,
          context,
        }),
      });

      const data = await res.json();
      if (data.context) setContext(data.context);
      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || "I couldn't process that query. Please try asking about a specific chapel or district.",
        isOffTopic: data.isOffTopic,
      };

      setMessages((prev) => [...prev, replyMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Unable to reach the assistant server. Please check your connection.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    'Is there an English service nearby?',
    'Directions to the nearest one',
    'What about Sunday?',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel — original dark glass design */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md glass-panel !rounded-none !border-r-0 !border-y-0 border-l border-white/20 flex flex-col bg-[#0B1426]/90 shadow-2xl">
          
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8A33D]/20 text-[#E8A33D] flex items-center justify-center border border-[#E8A33D]/40">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base leading-tight">Ask Assistant</h3>
                <span className="text-xs text-[#A9B4C2]">Kapilya Near Me — schedules &amp; wayfinding</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close Ask Drawer"
            >
              <X size={20} />
            </button>
          </div>

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
                            onClick={onClose}
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
                placeholder="Ask about a chapel, schedule, or directions..."
                className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#E8A33D] transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="btn-amber !p-2.5 rounded-lg disabled:opacity-40"
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
