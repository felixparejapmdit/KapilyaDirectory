'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { KapilyaLogo } from './KapilyaLogo';
import { useUserLocation } from './LocationProvider';

/**
 * Welcome splash shown on the initial load of the Dashboard ("/") only.
 *
 * SPLASH_BOOT_SCRIPT (lib/boot-scripts, inlined in <head>) sets html[data-splash] before first
 * paint: "on" for "/", "off" elsewhere, so deep links never flash it. Progress follows the
 * Dashboard's real loading steps; the splash stays up for at least MIN_DISPLAY_MS, then crossfades
 * into the app (html[data-splash="leaving"]) and unmounts. It never returns on in-app navigation
 * because the provider lives in the root layout.
 */

const MIN_DISPLAY_MS = 1300;
/** Fail-safe: never hold the app behind the splash longer than this. */
const MAX_DISPLAY_MS = 8000;
const EXIT_MS = 650;

export type SplashStep = 'location' | 'congregations' | 'dashboard';

const STEPS: { id: SplashStep; label: string; weight: number }[] = [
  { id: 'location', label: 'Getting your location…', weight: 0.3 },
  { id: 'congregations', label: 'Loading nearby congregations…', weight: 0.45 },
  { id: 'dashboard', label: 'Preparing your dashboard…', weight: 0.25 },
];

interface SplashContextType {
  /** Marks a loading step finished (no-op once the splash is gone). */
  completeStep: (step: SplashStep) => void;
}

const SplashContext = createContext<SplashContextType>({ completeStep: () => {} });

export function useSplash() {
  return useContext(SplashContext);
}

type Phase = 'showing' | 'leaving' | 'done';

const noopSubscribe = () => () => {};
/** The boot script's decision; the server render assumes "on" so its markup matches first paint. */
const readBootFlag = () => document.documentElement.dataset.splash ?? 'off';

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const { ready: locationReady } = useUserLocation();
  const bootFlag = useSyncExternalStore(noopSubscribe, readBootFlag, () => 'on');
  const enabled = bootFlag !== 'off';
  const [phase, setPhase] = useState<Phase>('showing');
  const [reported, setReported] = useState<Record<Exclude<SplashStep, 'location'>, boolean>>({
    congregations: false,
    dashboard: false,
  });
  const completed: Record<SplashStep, boolean> = { location: locationReady, ...reported };

  const completeStep = useCallback((step: SplashStep) => {
    if (step === 'location') return; // derived from LocationProvider
    setReported((c) => (c[step] ? c : { ...c, [step]: true }));
  }, []);

  const allDone = locationReady && reported.congregations && reported.dashboard;

  // Leave once every step is done and the minimum display time has passed (or at the fail-safe cap).
  useEffect(() => {
    if (!enabled || phase !== 'showing') return;
    const elapsed = performance.now();
    const wait = allDone ? Math.max(0, MIN_DISPLAY_MS - elapsed) : Math.max(0, MAX_DISPLAY_MS - elapsed);
    const t = window.setTimeout(() => setPhase('leaving'), wait);
    return () => window.clearTimeout(t);
  }, [enabled, phase, allDone]);

  // Crossfade out (CSS keys off html[data-splash]), then unmount.
  useEffect(() => {
    if (phase === 'leaving') {
      document.documentElement.dataset.splash = 'leaving';
      const t = window.setTimeout(() => {
        document.documentElement.dataset.splash = 'off';
        setPhase('done');
      }, EXIT_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  const value = useMemo(() => ({ completeStep }), [completeStep]);

  return (
    <SplashContext.Provider value={value}>
      {children}
      {enabled && phase !== 'done' && <SplashOverlay completed={completed} />}
    </SplashContext.Provider>
  );
}

function SplashOverlay({ completed }: { completed: Record<SplashStep, boolean> }) {
  const current = STEPS.find((s) => !completed[s.id]);
  const status = current ? current.label : 'Ready';
  const progress = STEPS.reduce((acc, s) => acc + (completed[s.id] ? s.weight : 0), 0);
  const percent = Math.round(progress * 100);

  return (
    <div className="kd-splash" aria-busy={percent < 100}>
      <div className="kd-splash-bg" aria-hidden="true">
        <span className="kd-splash-blob kd-splash-blob--steel" />
        <span className="kd-splash-blob kd-splash-blob--amber" />
        <span className="kd-splash-blob kd-splash-blob--green" />
        <span className="kd-splash-blob kd-splash-blob--navy" />
      </div>

      <div className="kd-splash-card">
        <div className="kd-splash-logo kd-splash-in" style={{ animationDelay: '0ms' }}>
          <div className="kd-splash-logo-inner">
            <KapilyaLogo size={54} />
          </div>
        </div>

        <h1 className="kd-splash-title kd-splash-in" style={{ animationDelay: '130ms' }}>
          Kapilya <span>Directory</span>
        </h1>
        <p className="kd-splash-tagline kd-splash-in" style={{ animationDelay: '260ms' }}>
          Find the nearest chapel, wherever you are
        </p>

        <div className="kd-splash-status kd-splash-in" style={{ animationDelay: '390ms' }}>
          <p role="status" aria-live="polite" className="kd-splash-status-text">
            {status}
          </p>
          <div
            className="kd-splash-track"
            role="progressbar"
            aria-label="Loading Kapilya Directory"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="kd-splash-bar" style={{ width: `${Math.max(6, percent)}%` }} />
            {percent < 100 && <div className="kd-splash-shimmer" />}
          </div>
        </div>
      </div>
    </div>
  );
}
