'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  MapPin,
  Globe2,
  Bookmark,
  Settings,
  Sparkles,
  Send,
  Sun,
  Moon,
  LocateFixed,
  Loader2,
  Mic,
} from 'lucide-react';
import { AskDrawer } from './AskDrawer';
import { useTheme } from './ThemeProvider';
import { KapilyaLogo } from './KapilyaLogo';
import { useShowSettings } from '@/lib/use-show-settings';
import { useUserLocation } from './LocationProvider';
import { setVoicePreference, useVoice } from './VoiceProvider';
import { VoiceOverlay } from './VoiceOverlay';

export function Navigation() {
  const pathname = usePathname();
  const [askOpen, setAskOpen] = useState(false);
  const [toast, setToastState] = useState<{ text: string; icon: 'voice' | 'gps' } | null>(null);
  const setToast = (text: string | null, icon: 'voice' | 'gps' = 'voice') => setToastState(text ? { text, icon } : null);
  // Voice assistant: "Hey Assistant" opens the Ask drawer and starts a spoken session.
  const { voice, state: voiceState } = useVoice();
  // "Hey Assistant" opens the Siri-style voice overlay (the Ask drawer has its own mic button).
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceWake, setVoiceWake] = useState(0);
  useEffect(() => {
    voice.setWakeHandler(() => {
      setAskOpen(false);
      setVoiceOpen(true);
      setVoiceWake((n) => n + 1);
    });
    return () => voice.setWakeHandler(null);
  }, [voice]);
  // Surface voice errors (blocked mic, unsupported browser) once each.
  const [shownVoiceError, setShownVoiceError] = useState<string | null>(null);
  if (voiceState.error !== shownVoiceError) {
    setShownVoiceError(voiceState.error);
    if (voiceState.error) setToast(voiceState.error);
  }

  const toggleVoice = () => {
    if (voiceState.enabled) {
      voice.disable();
      setVoicePreference(false);
      setToast('Voice assistant off.');
      return;
    }
    // enable() must start inside this tap (it unlocks speech on iPhone).
    setVoicePreference(true);
    void voice.enable().then((ok) => ok && setToast('Voice assistant on. Say “Hey Assistant”.'));
  };

  const voiceButton = (compact: boolean) => (
    <button
      onClick={toggleVoice}
      aria-pressed={voiceState.enabled}
      className={`relative rounded-lg border transition-all ${compact ? 'p-1.5' : 'p-2'} ${
        voiceState.enabled
          ? 'border-[#E8A33D]/60 bg-[#E8A33D]/15 text-[#E8A33D]'
          : `border-white/15 text-[#A9B4C2] hover:text-white ${compact ? 'bg-white/5' : 'hover:bg-white/10'}`
      }`}
      title={voiceState.enabled ? 'Voice assistant on: say “Hey Assistant” (click to turn off)' : 'Enable Voice Assistant'}
      aria-label={voiceState.enabled ? 'Turn off voice assistant' : 'Enable Voice Assistant'}
    >
      <Mic size={compact ? 15 : 17} />
      {voiceState.enabled && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E8A33D] ring-2 ring-[#0B1426] animate-pulse" aria-hidden />
      )}
    </button>
  );
  const { resolved: theme, toggleTheme } = useTheme();
  const router = useRouter();
  const { location, detectGps, isDetecting } = useUserLocation();
  // Settings (data sync, snapshots) is an admin tool: its menu button only shows on localhost.
  // Anywhere else it opens with Ctrl + . (desktop) or 5 quick taps on the logo (mobile).
  const { visible: showSettings } = useShowSettings();
  const logoTaps = useRef<number[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== '.') return;
      e.preventDefault();
      router.push('/settings');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  /** 5 taps on the logo within 3 seconds opens Settings (the mobile counterpart of Ctrl + .). */
  const onLogoClick = (e: React.MouseEvent) => {
    const now = e.timeStamp;
    logoTaps.current = [...logoTaps.current.filter((t) => now - t < 3000), now];
    if (logoTaps.current.length >= 5) {
      logoTaps.current = [];
      e.preventDefault();
      router.push('/settings');
    }
  };

  /** Menu-bar GPS button: the browser asks for permission, then the whole app uses the fix. */
  const useMyLocation = () => {
    detectGps({ quiet: true })
      .then(() => setToast('Location set to your current GPS position.', 'gps'))
      .catch((err: Error) => setToast(err.message, 'gps'));
  };

  const gpsButton = (compact: boolean) => (
    <button
      onClick={useMyLocation}
      disabled={isDetecting}
      className={`relative rounded-lg border border-white/15 transition-all disabled:opacity-70 ${
        compact ? 'p-1.5 bg-white/5' : 'p-2 hover:bg-white/10'
      } ${location.isGps ? 'text-[#4ADE80]' : 'text-[#5AA9FF] hover:text-white'}`}
      title={location.isGps ? 'Using your GPS location (click to update it)' : 'Use my GPS location'}
      aria-label="Use my GPS location"
    >
      {isDetecting ? (
        <Loader2 size={compact ? 15 : 17} className="animate-spin" />
      ) : (
        <LocateFixed size={compact ? 15 : 17} />
      )}
      {location.isGps && !isDetecting && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#4ADE80] ring-2 ring-[#0B1426]" aria-hidden />
      )}
    </button>
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToastState(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const navLinks = [
    { label: 'Dashboard', href: '/', icon: Compass },
    { label: 'Near me', href: '/near-me', icon: MapPin },
    { label: 'Districts', href: '/districts', icon: Globe2 },
    { label: 'Favorites', href: '/saved', icon: Bookmark },
    ...(showSettings ? [{ label: 'Settings', href: '/settings', icon: Settings }] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      {/* --- DESKTOP TOP NAV (>= 820px) --- */}
      <header className="site-header hidden md:block sticky top-0 z-40 px-6 py-3">
        <div className="max-w-7xl mx-auto glass-panel px-6 py-3 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" onClick={onLogoClick} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3A6EA5] to-[#E8A33D] p-0.5 shadow-lg group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0B1426] rounded-[10px] flex items-center justify-center p-1.5">
                <KapilyaLogo size={24} />
              </div>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                Kapilya <span className="text-[#E8A33D] font-normal">Directory</span>
              </span>
              <span className="block text-[10px] text-[#A9B4C2] uppercase tracking-wider font-semibold">
                Worldwide INC Finder
              </span>
            </div>
          </Link>

          {/* Primary Nav Links */}
          <nav className="flex items-center gap-1 bg-black/20 p-1.5 rounded-xl border border-white/10 nav-capsule">
            {/* Dashboard Link */}
            <Link
              href="/"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/')
                  ? 'bg-[#E8A33D] text-[#0B1426] font-semibold shadow-md active-nav'
                  : 'text-[#A9B4C2] hover:text-white hover:bg-white/5 inactive-nav'
              }`}
            >
              <Compass size={16} className={isActive('/') ? 'text-[#0B1426]' : 'text-[#A9B4C2]'} />
              Dashboard
            </Link>

            {/* Remaining Nav Links */}
            {navLinks.slice(1).map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#E8A33D] text-[#0B1426] font-semibold shadow-md active-nav'
                      : 'text-[#A9B4C2] hover:text-white hover:bg-white/5 inactive-nav'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-[#0B1426]' : 'text-[#A9B4C2]'} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions: GPS, Theme Toggle, Ask & Telegram */}
          <div className="flex items-center gap-2.5">
            {voiceButton(false)}
            {gpsButton(false)}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[#A9B4C2] hover:text-white hover:bg-white/10 border border-white/15 transition-all"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun size={17} className="text-[#E8A33D] hover:rotate-45 transition-transform" />
              ) : (
                <Moon size={17} className="text-[#3A6EA5]" />
              )}
            </button>

            <button
              onClick={() => setAskOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all shadow-sm group"
            >
              <Sparkles size={16} className="text-[#E8A33D] group-hover:rotate-12 transition-transform" />
              <span>Ask</span>
            </button>

            <Link
              href="/telegram"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#3A6EA5]/25 hover:bg-[#3A6EA5]/40 text-[#5AA9FF] border border-[#3A6EA5]/40 transition-all shadow-sm"
              title="Telegram Bot Companion"
            >
              <Send size={15} />
              <span>Bot</span>
            </Link>
          </div>
        </div>
      </header>

      {/* --- MOBILE SLIM TOP APP BAR (< 820px) --- */}
      <header className="site-header md:hidden sticky top-0 z-40 px-3 py-2 border-b border-white/10 flex items-center justify-between mobile-header gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/" onClick={onLogoClick} className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#E8A33D] text-[#0B1426] flex items-center justify-center p-1 font-bold shadow-md">
              <KapilyaLogo size={20} />
            </div>
            <span className="font-bold text-white text-sm tracking-tight hidden xs:inline">
              Kapilya
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          {voiceButton(true)}
          {gpsButton(true)}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-[#A9B4C2] hover:text-white bg-white/5 border border-white/15"
            title="Toggle Theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} className="text-[#E8A33D]" /> : <Moon size={15} className="text-[#3A6EA5]" />}
          </button>
          <button
            onClick={() => setAskOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white border border-white/15"
          >
            <Sparkles size={14} className="text-[#E8A33D]" />
            <span>Ask</span>
          </button>
          <Link
            href="/telegram"
            className="p-2 rounded-lg text-[#5AA9FF] bg-[#3A6EA5]/20 border border-[#3A6EA5]/30"
          >
            <Send size={14} />
          </Link>
        </div>
      </header>

      {/* --- MOBILE BOTTOM TAB BAR (< 820px) --- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-panel !rounded-none !border-x-0 !border-b-0 border-t border-white/20 bg-[#0B1426]/95 backdrop-blur-xl px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className={`grid gap-1 ${navLinks.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {navLinks.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center py-1 min-h-[48px] relative group text-center"
              >
                {active && (
                  <span className="absolute top-0 w-8 h-1 bg-[#E8A33D] rounded-full shadow-[0_0_8px_#E8A33D]" />
                )}
                <Icon
                  size={20}
                  className={`transition-colors ${
                    active ? 'text-[#E8A33D]' : 'text-[#A9B4C2]'
                  }`}
                />
                <span
                  className={`text-[11px] mt-1 font-medium transition-colors ${
                    active ? 'text-[#E8A33D] font-bold' : 'text-[#A9B4C2]'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* The Scoped Ask Assistant Drawer */}
      <AskDrawer isOpen={askOpen} onClose={() => setAskOpen(false)} />
      <VoiceOverlay open={voiceOpen} trigger={voiceWake} onClose={() => setVoiceOpen(false)} />

      {/* GPS result */}
      {toast && (
        <div role="status" className="kd-toast fixed left-1/2 bottom-24 md:bottom-8 z-[60] -translate-x-1/2 glass-panel px-4 py-2.5 text-sm font-semibold text-white flex items-center gap-2 shadow-2xl">
          {toast.icon === 'gps' ? (
            <LocateFixed size={15} className="text-[#E8A33D] shrink-0" />
          ) : (
            <Mic size={15} className="text-[#E8A33D] shrink-0" />
          )}
          {toast.text}
        </div>
      )}
    </>
  );
}
