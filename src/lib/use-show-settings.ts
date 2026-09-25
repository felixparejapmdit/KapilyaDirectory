import { useSyncExternalStore } from 'react';

const UNLOCK_KEY = 'kapilya_settings_unlocked';
const CHANGE_EVENT = 'kapilya-settings-visibility';

function isLocalhost(): boolean {
  const host = window.location.hostname;
  return host.includes('localhost') || host === '127.0.0.1';
}

function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Toggles the Settings link on non-localhost addresses (Ctrl + .). Returns the new state. */
export function toggleSettingsUnlocked(): boolean {
  const next = !isUnlocked();
  try {
    if (next) localStorage.setItem(UNLOCK_KEY, '1');
    else localStorage.removeItem(UNLOCK_KEY);
  } catch {
    // storage unavailable: nothing to persist
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return next;
}

/**
 * Whether admin UI (the Settings link) is shown: always on localhost, elsewhere only after
 * Ctrl + . unlocks it on this device. Reads browser state, so it is false during server rendering
 * and settles after hydration.
 */
export function useShowSettings(): { visible: boolean; localhost: boolean } {
  const localhost = useSyncExternalStore(subscribe, isLocalhost, () => false);
  const unlocked = useSyncExternalStore(subscribe, isUnlocked, () => false);
  return { visible: localhost || unlocked, localhost };
}
