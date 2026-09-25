import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * Whether the Settings link is shown in the menu: only on localhost. Elsewhere the page stays
 * reachable without a visible button: Ctrl + . on desktop, or tap the logo 5 times on mobile.
 * Reads the browser URL, so it is false during server rendering and settles after hydration.
 */
export function useShowSettings(): { visible: boolean } {
  const visible = useSyncExternalStore(
    noopSubscribe,
    () => window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1',
    () => false
  );
  return { visible };
}
