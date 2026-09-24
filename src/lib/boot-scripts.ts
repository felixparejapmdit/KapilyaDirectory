/**
 * Inline scripts the root layout runs before first paint. Kept out of 'use client' modules:
 * a server component importing a constant from one gets a client reference, not the string.
 */

export const THEME_KEY = 'kapilya_theme';
export const TRANSPARENCY_KEY = 'kapilya_reduced_transparency';

/** Sets html[data-theme] (+ .light/.dark) and html[data-transparency] from saved preferences. */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('${THEME_KEY}')||'dark';var r=t==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;d.dataset.theme=r;d.classList.add(r);d.classList.remove(r==='light'?'dark':'light');if(localStorage.getItem('${TRANSPARENCY_KEY}')==='1')d.dataset.transparency='reduced';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

/** Mirrors the light theme onto <body> (the stylesheet keys off body.light-theme). */
export const THEME_BODY_SCRIPT = `if(document.documentElement.dataset.theme==='light')document.body.classList.add('light-theme');`;

/** The welcome splash shows only on the initial load of the Dashboard ("/"). */
export const SPLASH_BOOT_SCRIPT = `document.documentElement.dataset.splash=location.pathname==='/'?'on':'off';`;
