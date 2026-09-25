'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { AskDrawer } from './AskDrawer';
import { useTheme } from './ThemeProvider';
import { KapilyaLogo } from './KapilyaLogo';
import { toggleSettingsUnlocked, useShowSettings } from '@/lib/use-show-settings';

export function Navigation() {
  const pathname = usePathname();
  const [askOpen, setAskOpen] = useState(false);
  const { resolved: theme, toggleTheme } = useTheme();
  // Settings (data sync, snapshots) is an admin tool: its nav button shows on localhost, and
  // elsewhere after Ctrl + . (toggle) unlocks it on this device.
  const { visible: showSettings, localhost } = useShowSettings();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (localhost) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== '.') return;
      e.preventDefault();
      const unlocked = toggleSettingsUnlocked();
      setToast(unlocked ? 'Settings unlocked. Press Ctrl + . again to hide it.' : 'Settings hidden.');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [localhost]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
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
          <Link href="/" className="flex items-center gap-3 group">
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

          {/* Actions: Theme Toggle, Ask & Telegram */}
          <div className="flex items-center gap-2.5">
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
          <Link href="/" className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#E8A33D] text-[#0B1426] flex items-center justify-center p-1 font-bold shadow-md">
              <KapilyaLogo size={20} />
            </div>
            <span className="font-bold text-white text-sm tracking-tight hidden xs:inline">
              Kapilya
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
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

      {/* Ctrl + . confirmation */}
      {toast && (
        <div role="status" className="kd-toast fixed left-1/2 bottom-24 md:bottom-8 z-[60] -translate-x-1/2 glass-panel px-4 py-2.5 text-sm font-semibold text-white flex items-center gap-2 shadow-2xl">
          <Settings size={15} className="text-[#E8A33D]" />
          {toast}
        </div>
      )}
    </>
  );
}
