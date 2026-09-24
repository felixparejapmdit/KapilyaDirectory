import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * True when the app is opened on localhost (admin-only UI such as the Settings link shows there).
 * Read from the browser URL, so it is false during server rendering and settles after hydration.
 */
export function useIsLocalhost(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1',
    () => false
  );
}
