'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** This browser's anonymous visitor ID in localStorage (the site has no accounts). */
export const VISITOR_KEY = 'kapilya_vid';

function newId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The visitor ID, created on first use. */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'nostorage';
  }
}

interface UADataLike {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string; model?: string }>;
}

let hints: Promise<Record<string, unknown>> | null = null;
/** Chrome/Edge Client Hints: exact Windows version and Android phone model. */
function clientHints(): Promise<Record<string, unknown>> {
  const uad = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData;
  if (!uad) return Promise.resolve({});
  hints ??= (uad.getHighEntropyValues?.(['platformVersion', 'model']) ?? Promise.resolve<{ platformVersion?: string; model?: string }>({}))
    .then((h) => ({ platform: uad.platform, mobile: uad.mobile, platformVersion: h.platformVersion, model: h.model }))
    .catch(() => ({ platform: uad.platform, mobile: uad.mobile }));
  return hints;
}

let last = { path: '', at: 0 };
let firstView = true;

/** Records each page view in the access log (Settings → Access log). */
export function AccessBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const now = Date.now();
    if (last.path === pathname && now - last.at < 5000) return; // re-renders, not new visits
    last = { path: pathname, at: now };
    // The referrer only means "came from another site" on the first page of a visit.
    const ref = firstView && document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : undefined;
    firstView = false;

    void clientHints().then((h) => {
      const body = JSON.stringify({
        path: pathname + (location.search.length <= 120 ? location.search : ''),
        vid: getVisitorId(),
        ref,
        screen: `${screen.width}×${screen.height}`,
        lang: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        touch: navigator.maxTouchPoints,
        hints: h,
      });
      const sent = navigator.sendBeacon?.('/api/access-log', new Blob([body], { type: 'application/json' }));
      if (!sent) {
        fetch('/api/access-log', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
      }
    });
  }, [pathname]);

  return null;
}
