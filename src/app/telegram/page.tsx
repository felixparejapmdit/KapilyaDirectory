'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Send, ArrowLeft, Bot, MapPin, CheckCircle2, Sparkles, User } from 'lucide-react';
import type { District, Locale } from '@/lib/types';
import { useUserLocation } from '@/components/LocationProvider';
import { directionsUrl, formatDistance } from '@/lib/geo';
import { formatTime12Hour } from '@/lib/time';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  buttons?: { label: string; action: () => void }[];
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "   🕒 Thursday: 6:00 AM, 7:00 PM" lines, Monday-first. */
function scheduleLines(l: Locale): string {
  const sched = l.schedule ?? [];
  if (sched.length === 0) return '   🕒 No schedule posted';
  return WEEK_ORDER.map((d) => sched.filter((s) => s.day_of_week === d))
    .filter((day) => day.length > 0)
    .map((day) => `   🕒 ${day[0].day_name}: ${day.map((s) => formatTime12Hour(s.start_time)).join(', ')}`)
    .join('\n');
}

export default function TelegramPage() {
  const { location } = useUserLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Welcome to **Kapilya Directory Bot**!\n\nI can help you find Iglesia Ni Cristo congregations, check worship service departure boards, and subscribe to service reminders directly in Telegram.\n\nAvailable commands:\n• `/nearme` — Share location to find nearest chapels\n• `/district <name>` — Browse a specific district\n• `/subscribe <locale>` — Get reminders before service starts",
    },
  ]);
  const [input, setInput] = useState('');

  const sendCommand = (cmd: string) => {
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: cmd,
    };

    setMessages((prev) => [...prev, userMsg]);
    void replyTo(cmd).then((botResponse) => setMessages((prev) => [...prev, botResponse]));
  };

  // Answers come from the live directory data, the same data the real bot uses.
  const replyTo = async (cmd: string): Promise<ChatMessage> => {
    const id = `bot-${Date.now()}`;
    try {
      if (cmd.startsWith('/nearme')) {
        const res = await fetch(`/api/locales/nearby?lat=${location.lat}&lng=${location.lng}&radius=80&limit=3`);
        const { locales = [] }: { locales: Locale[] } = await res.json();
        if (locales.length === 0) {
          return { id, sender: 'bot', text: `❌ No congregations found within 80 km of **${location.name}**.` };
        }
        const top = locales[0];
        return {
          id,
          sender: 'bot',
          text:
            `📍 **Nearby Congregations (${location.name}):**\n\n` +
            locales
              .map((l, i) => `${i + 1}. **${l.name}** — ${formatDistance(l.distance_km)}\n${scheduleLines(l)}`)
              .join('\n\n'),
          buttons: [
            {
              label: `🗺️ Directions to ${top.name}`,
              action: () => window.open(directionsUrl(top.latitude, top.longitude, top.name), '_blank'),
            },
            {
              label: `🔔 Subscribe to ${top.name}`,
              action: () => sendCommand(`/subscribe ${top.name}`),
            },
          ],
        };
      }

      if (cmd.startsWith('/district')) {
        const query = cmd.replace('/district', '').trim().toLowerCase() || 'alaska';
        const { districts = [] }: { districts: District[] } = await (await fetch('/api/districts')).json();
        const match =
          districts.find((d) => d.name.toLowerCase() === query || d.slug === query) ??
          districts.find((d) => d.name.toLowerCase().includes(query) || d.slug.includes(query));
        if (!match) {
          return { id, sender: 'bot', text: `❌ No district matches "${query}". Try '/district Alaska' or '/district Central'.` };
        }
        const { district } = await (await fetch(`/api/districts/${match.slug}`)).json();
        const locales: Locale[] = district?.locales ?? [];
        const shown = locales.slice(0, 6);
        return {
          id,
          sender: 'bot',
          text:
            `🏛️ **District of ${match.name}** (${locales.length} locales):\n\n` +
            shown.map((l) => `• **${l.name}**\n${scheduleLines(l)}`).join('\n') +
            (locales.length > shown.length ? `\n\n…and ${locales.length - shown.length} more.` : ''),
        };
      }

      if (cmd.startsWith('/subscribe')) {
        const localeName = cmd.replace('/subscribe', '').trim() || 'your local chapel';
        return {
          id,
          sender: 'bot',
          text: `✅ **Subscribed!** You will receive a reminder notification on Telegram 30 minutes before every worship service starts at **${localeName}**.`,
        };
      }
    } catch {
      return { id, sender: 'bot', text: '⚠️ The directory could not be reached. Please try again.' };
    }

    return {
      id,
      sender: 'bot',
      text: `Unknown command. Please try '/nearme', '/district Alaska', or '/subscribe Templo Central'.`,
    };
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A9B4C2] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back to Directory</span>
      </Link>

      {/* Header */}
      <div className="glass-panel p-5 border border-white/15 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3A6EA5] text-white flex items-center justify-center shadow-lg">
            <Bot size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">@KapilyaDirectory_bot</h1>
            <span className="text-xs text-[#5AA9FF] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Bot Companion (Live Simulator & Real Bot Active)
            </span>
          </div>
        </div>

        <a
          href="https://t.me/KapilyaDirectory_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-amber text-xs px-3.5 py-2 flex items-center gap-1.5"
        >
          <Send size={14} />
          <span>Open @KapilyaDirectory_bot</span>
        </a>
      </div>

      {/* Chat Simulation Window */}
      <div className="glass-panel border border-white/15 flex flex-col h-[520px] rounded-2xl overflow-hidden bg-[#0B1426]/95 shadow-2xl">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${
                  m.sender === 'user'
                    ? 'bg-[#E8A33D] text-[#0B1426] font-semibold'
                    : 'bg-[#16233E] text-white border border-white/10'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                {m.buttons && (
                  <div className="mt-3 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                    {m.buttons.map((btn, i) => (
                      <button
                        key={i}
                        onClick={btn.action}
                        className="text-xs py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-left transition-colors"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Commands Bar */}
        <div className="p-2 border-t border-white/10 bg-black/30 flex gap-2 overflow-x-auto">
          <button
            onClick={() => sendCommand('/nearme')}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 shrink-0"
          >
            /nearme
          </button>
          <button
            onClick={() => sendCommand('/district Alaska')}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 shrink-0"
          >
            /district Alaska
          </button>
          <button
            onClick={() => sendCommand('/subscribe Templo Central')}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 shrink-0"
          >
            /subscribe Templo Central
          </button>
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 bg-[#0B1426]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) {
                sendCommand(input);
                setInput('');
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command (/nearme, /district, /subscribe)..."
              className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#A9B4C2]/50 focus:outline-none focus:border-[#E8A33D]"
            />
            <button type="submit" className="btn-amber !p-2.5 rounded-xl">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
