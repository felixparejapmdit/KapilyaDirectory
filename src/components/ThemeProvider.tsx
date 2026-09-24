'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { THEME_KEY, TRANSPARENCY_KEY } from '@/lib/boot-scripts';

export type ThemePref = 'dark' | 'light' | 'system';
type Resolved = 'dark' | 'light';

interface ThemeContextType {
  /** The user's preference (may be "system"). */
  theme: ThemePref;
  /** The theme actually applied. */
  resolved: Resolved;
  setTheme: (theme: ThemePref) => void;
  /** Flips between explicit dark and light. */
  toggleTheme: () => void;
  reducedTransparency: boolean;
  setReducedTransparency: (v: boolean) => void;
}

const CHANGE_EVENT = 'kapilya-appearance-change';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolved: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  reducedTransparency: false,
  setReducedTransparency: () => {},
});

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice still applies for this page view
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Appearance prefs live in localStorage; re-read on changes from this tab or others. */
function subscribePrefs(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function subscribeSystemTheme(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const readThemePref = (): ThemePref => {
  const raw = readStorage(THEME_KEY);
  return raw === 'light' || raw === 'system' ? raw : 'dark';
};
const readSystemTheme = (): Resolved => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
const readReducedTransparency = () => readStorage(TRANSPARENCY_KEY) === '1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server snapshots are the defaults (dark, opaque off); the boot script already painted the real theme.
  const theme = useSyncExternalStore(subscribePrefs, readThemePref, () => 'dark' as ThemePref);
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, readSystemTheme, () => 'dark' as Resolved);
  const reducedTransparency = useSyncExternalStore(subscribePrefs, readReducedTransparency, () => false);
  const resolved: Resolved = theme === 'system' ? systemTheme : theme;

  // Mirror the theme onto the document (classes the CSS keys off, and the browser chrome color).
  // Reads the live prefs rather than `resolved`: the hydration pass renders with server defaults,
  // and applying those would briefly undo the boot script's light theme.
  useEffect(() => {
    const pref = readThemePref();
    const live: Resolved = pref === 'system' ? readSystemTheme() : pref;
    const root = document.documentElement;
    root.dataset.theme = live;
    root.classList.toggle('light', live === 'light');
    root.classList.toggle('dark', live === 'dark');
    document.body.classList.toggle('light-theme', live === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', live === 'dark' ? '#0B1426' : '#F8FAFC');
  }, [resolved]);

  useEffect(() => {
    if (readReducedTransparency()) document.documentElement.dataset.transparency = 'reduced';
    else delete document.documentElement.dataset.transparency;
  }, [reducedTransparency]);

  const setTheme = useCallback((t: ThemePref) => writeStorage(THEME_KEY, t), []);
  const toggleTheme = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme]);
  const setReducedTransparency = useCallback((v: boolean) => writeStorage(TRANSPARENCY_KEY, v ? '1' : '0'), []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggleTheme, reducedTransparency, setReducedTransparency }),
    [theme, resolved, setTheme, toggleTheme, reducedTransparency, setReducedTransparency]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
