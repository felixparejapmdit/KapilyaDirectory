'use client';

import React, { useId } from 'react';

interface KapilyaLogoProps {
  size?: number;
  className?: string;
}

/**
 * Kapilya Directory Official Icon — Premium Location Pin
 * A modern app-icon-style location pin: amber-gold teardrop on dark navy background.
 * Zero religious symbols. Clean, flat design with subtle gradient depth.
 */
export function KapilyaLogo({ size = 24, className = '' }: KapilyaLogoProps) {
  // Unique gradient ids per instance: a shared id resolves to the first logo in the document,
  // which renders nothing when that copy is hidden (e.g. the desktop header on mobile).
  const uid = useId().replace(/:/g, '');
  const bodyId = `pinBodyGrad-${uid}`;
  const dotId = `dotGlow-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kapilya Directory"
    >
      <defs>
        <linearGradient id={bodyId} x1="13" y1="4" x2="19" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5C060" />
          <stop offset="55%" stopColor="#E8A33D" />
          <stop offset="100%" stopColor="#B87A20" />
        </linearGradient>
        <radialGradient id={dotId} cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8E8F0" />
        </radialGradient>
      </defs>

      {/* Pin body — smooth teardrop */}
      <path
        d="M16 3C10.477 3 6 7.477 6 13C6 18.5 13.5 26.5 15.4 28.55C15.73 28.9 16.27 28.9 16.6 28.55C18.5 26.5 26 18.5 26 13C26 7.477 21.523 3 16 3Z"
        fill={`url(#${bodyId})`}
      />

      {/* Dark inner ring */}
      <circle cx="16" cy="13" r="5.2" fill="#0B1426" />

      {/* White glowing center dot */}
      <circle cx="16" cy="13" r="3.2" fill={`url(#${dotId})`} />
    </svg>
  );
}
