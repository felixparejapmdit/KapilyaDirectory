'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import type { Locale, LocaleKind } from '@/lib/types';
import { findNextService, formatCountdown } from '@/lib/next-service';
import { formatTime12Hour } from '@/lib/time';

type KindFilter = 'all' | LocaleKind;

interface DistrictDetail {
  name: string;
  slug: string;
  timezone: string;
  locales: Locale[];
}

const OPEN_DELAY_MS = 220;
const CLOSE_DELAY_MS = 160;
const CARD_WIDTH = 380;
const CARD_MAX_HEIGHT = 460;

const SECTIONS: { kind: LocaleKind; label: string; dot: string }[] = [
  { kind: 'local_congregation', label: 'Local congregations', dot: 'bg-[#5AA9FF]' },
  { kind: 'extension', label: 'Extensions', dot: 'bg-[#E8A33D]' },
  { kind: 'group_worship_service', label: 'Group worship services', dot: 'bg-[#4ADE80]' },
];

// Fetched district details, shared across hovers for the page's lifetime.
const cache = new Map<string, Promise<DistrictDetail | null>>();
function loadDistrict(slug: string) {
  if (!cache.has(slug)) {
    cache.set(
      slug,
      fetch(`/api/districts/${slug}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.district ?? null)
        .catch(() => {
          cache.delete(slug);
          return null;
        })
    );
  }
  return cache.get(slug)!;
}

/**
 * Hover preview for district links (pointer devices only; touch keeps tap-to-open).
 * Returns props to spread on each district link plus the card element to render once.
 */
export function useDistrictHoverCard(kind: KindFilter) {
  const [target, setTarget] = useState<{ slug: string; rect: DOMRect } | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const cancelClose = useCallback(() => window.clearTimeout(closeTimer.current), []);
  const scheduleClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setTarget(null), CLOSE_DELAY_MS);
  }, []);
  const close = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    setTarget(null);
  }, []);

  // Close on page scroll/resize (the card is positioned against the link) and on Escape.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [target, close]);

  const linkProps = (slug: string) =>
    canHover
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const el = e.currentTarget;
            cancelClose();
            window.clearTimeout(openTimer.current);
            void loadDistrict(slug); // warm the cache while the intent delay runs
            openTimer.current = window.setTimeout(() => setTarget({ slug, rect: el.getBoundingClientRect() }), OPEN_DELAY_MS);
          },
          onMouseLeave: scheduleClose,
          'aria-haspopup': 'dialog' as const,
          'data-previewing': target?.slug === slug ? 'true' : undefined,
        }
      : {};

  const card = target ? (
    <DistrictCard
      key={target.slug}
      slug={target.slug}
      anchor={target.rect}
      kind={kind}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      onNavigate={close}
    />
  ) : null;

  return { linkProps, card };
}

/** Below the link when there's room, otherwise above; clamped to the viewport. */
function cardPosition(anchor: DOMRect) {
  const margin = 12;
  const width = Math.min(CARD_WIDTH, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(anchor.left - 12, margin), window.innerWidth - width - margin);
  const spaceBelow = window.innerHeight - anchor.bottom;
  const below = spaceBelow >= Math.min(CARD_MAX_HEIGHT, 320) || spaceBelow >= anchor.top;
  const originX = `${Math.max(16, anchor.left + anchor.width / 2 - left)}px`;
  // Never taller than the space on the chosen side (the list inside scrolls).
  const maxHeight = Math.max(220, Math.min(CARD_MAX_HEIGHT, (below ? spaceBelow : anchor.top) - 8 - margin));
  return below
    ? { left, width, maxHeight, top: anchor.bottom + 8, bottom: undefined, origin: `${originX} top` }
    : { left, width, maxHeight, top: undefined, bottom: window.innerHeight - anchor.top + 8, origin: `${originX} bottom` };
}

function DistrictCard({
  slug,
  anchor,
  kind,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
}: {
  slug: string;
  anchor: DOMRect;
  kind: KindFilter;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onNavigate: () => void;
}) {
  const [detail, setDetail] = useState<DistrictDetail | null | undefined>(undefined);
  // Chip filter inside the card; starts from the page's type filter.
  const [shown, setShown] = useState<KindFilter>(kind);
  const pos = useMemo(() => cardPosition(anchor), [anchor]);

  useEffect(() => {
    let alive = true;
    loadDistrict(slug).then((d) => alive && setDetail(d));
    return () => {
      alive = false;
    };
  }, [slug]);

  const all = detail?.locales ?? [];
  const counts = Object.fromEntries(SECTIONS.map((s) => [s.kind, all.filter((l) => l.kind === s.kind).length])) as Record<
    LocaleKind,
    number
  >;
  const sections = SECTIONS.filter((s) => (shown === 'all' || s.kind === shown) && counts[s.kind] > 0);
  const now = new Date();
  let row = 0;

  return createPortal(
    <div
      role="dialog"
      aria-label={detail ? `${detail.name} congregations` : 'District preview'}
      className="kd-hovercard"
      style={{
        left: pos.left,
        top: pos.top,
        bottom: pos.bottom,
        width: pos.width,
        maxHeight: pos.maxHeight,
        transformOrigin: pos.origin,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {detail === undefined ? (
        <div className="p-4 space-y-3" aria-busy="true">
          <div className="kd-hovercard-skeleton h-5 w-40" />
          <div className="kd-hovercard-skeleton h-3 w-56" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="kd-hovercard-skeleton h-9 w-full" />
          ))}
        </div>
      ) : detail === null ? (
        <p className="p-4 text-sm kd-hovercard-muted">This district couldn&apos;t be loaded.</p>
      ) : (
        <>
          {/* Header */}
          <div className="px-4 pt-4 pb-3 kd-hovercard-divider">
            <p className="text-base font-bold leading-tight kd-hovercard-title">District of {detail.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Show congregations by type">
              <button
                type="button"
                aria-pressed={shown === 'all'}
                onClick={() => setShown('all')}
                className="kd-hovercard-chip"
              >
                All <b className="font-departure">{all.length}</b>
              </button>
              {SECTIONS.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={shown === s.kind}
                  disabled={counts[s.kind] === 0}
                  onClick={() => setShown(shown === s.kind ? 'all' : s.kind)}
                  className="kd-hovercard-chip"
                  title={`Show ${s.label.toLowerCase()} only`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {s.kind === 'local_congregation' ? 'Local' : s.kind === 'extension' ? 'Ext' : 'GWS'}{' '}
                  <b className="font-departure">{counts[s.kind]}</b>
                </button>
              ))}
              <span className="ml-auto flex items-center gap-1 text-[11px] kd-hovercard-muted">
                <Clock size={11} /> {detail.timezone.split('/').pop()?.replace(/_/g, ' ')} time
              </span>
            </div>
          </div>

          {/* Congregations, grouped by kind */}
          <div key={shown} className="kd-hovercard-list min-h-0 flex-1">
            {sections.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm kd-hovercard-muted">No congregations of this type here.</p>
            ) : (
              sections.map((s) => (
                <div key={s.kind}>
                  <p className="kd-hovercard-section">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </p>
                  <ul>
                    {all
                      .filter((l) => l.kind === s.kind)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((l) => {
                        const next = findNextService(l.schedule, l.timezone ?? detail.timezone, now);
                        const delay = Math.min(row++, 14) * 22;
                        return (
                          <li key={l.id} className="kd-hovercard-row" style={{ animationDelay: `${delay}ms` }}>
                            <Link href={`/locales/${l.id}`} onClick={onNavigate} className="kd-hovercard-link group">
                              <MapPin size={13} className="shrink-0 kd-hovercard-muted group-hover:text-[#E8A33D]" />
                              <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                              {!next ? (
                                <span className="text-[11px] kd-hovercard-muted">No schedule</span>
                              ) : next.startsInMinutes <= 0 ? (
                                <span className="kd-hovercard-live">Now</span>
                              ) : next.startsInMinutes <= 120 ? (
                                <span className="kd-hovercard-soon font-departure">{formatCountdown(next.startsInMinutes)}</span>
                              ) : (
                                <span className="font-departure text-[11px] kd-hovercard-muted">
                                  {next.item.day_name.slice(0, 3)} {formatTime12Hour(next.item.start_time)}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <Link href={`/districts/${detail.slug}`} onClick={onNavigate} className="kd-hovercard-footer group">
            <span>
              Open district · <span className="font-departure">{all.length}</span> locales
            </span>
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </>
      )}
    </div>,
    document.body
  );
}
