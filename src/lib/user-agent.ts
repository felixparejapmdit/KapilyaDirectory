/**
 * Readable device details from a browser's User-Agent, improved with Client Hints where the browser
 * sends them (Chrome/Edge: exact Windows 11 vs 10, Android phone model). No dependencies.
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot';

export interface ClientHints {
  /** navigator.userAgentData.platform, e.g. "Windows", "Android", "macOS". */
  platform?: string;
  /** High-entropy platformVersion, e.g. "15.0.0" (Windows 11 is 13+). */
  platformVersion?: string;
  /** High-entropy model, e.g. "SM-S918B" or "Pixel 8". */
  model?: string;
  mobile?: boolean;
  /** navigator.maxTouchPoints: tells an iPad (which says "Macintosh") from a Mac. */
  touch?: number;
}

export interface DeviceInfo {
  device: DeviceType;
  /** e.g. "Windows 11", "iOS 17.5", "Android 14". */
  os: string;
  /** e.g. "Windows", "iOS", "Android" (for filtering). */
  osFamily: string;
  /** e.g. "Chrome 126", "Safari 17". */
  browser: string;
  /** e.g. "Chrome", "Safari" (for filtering). */
  browserFamily: string;
  /** e.g. "iPhone", "SM-S918B", "Pixel 8". */
  model?: string;
}

const BOT =
  /bot\b|bot\/|crawler|spider|crawling|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|curl\/|wget|python-requests|axios|node-fetch|go-http|vercel-screenshot/i;

const BROWSERS: [RegExp, string][] = [
  [/HeadlessChrome\/(\d+)/, 'Headless Chrome'],
  [/EdgiOS\/(\d+)|EdgA\/(\d+)|Edg\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)|Opera\/(\d+)/, 'Opera'],
  [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/FBAV\/(\d+)|FBAN/, 'Facebook app'],
  [/Instagram (\d+)/, 'Instagram app'],
  [/Line\/(\d+)/, 'LINE app'],
  [/CriOS\/(\d+)/, 'Chrome'],
  [/FxiOS\/(\d+)/, 'Firefox'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)(?:\.\d+)*.*Safari/, 'Safari'],
];

const WINDOWS: Record<string, string> = { '10.0': 'Windows 10/11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' };

export function parseUserAgent(ua: string, hints: ClientHints = {}): DeviceInfo {
  let osFamily = 'Other';
  let os = 'Other';
  let model: string | undefined;
  let m: RegExpMatchArray | null;
  const macWithTouch = /Macintosh/.test(ua) && (hints.touch ?? 0) > 1;

  if (/iPhone|iPod/.test(ua)) {
    osFamily = 'iOS';
    m = ua.match(/OS (\d+)[_.](\d+)/);
    os = m ? `iOS ${m[1]}.${m[2]}` : 'iOS';
    model = /iPod/.test(ua) ? 'iPod' : 'iPhone';
  } else if (/iPad/.test(ua) || macWithTouch) {
    osFamily = 'iPadOS';
    m = ua.match(/OS (\d+)[_.](\d+)/) ?? ua.match(/Version\/(\d+)\.(\d+)/);
    os = m ? `iPadOS ${m[1]}.${m[2]}` : 'iPadOS';
    model = 'iPad';
  } else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) {
    osFamily = 'Android';
    // Chrome freezes the UA at "Android 10"; Client Hints carry the real version.
    const major = parseInt(hints.platformVersion ?? '', 10);
    os = `Android ${!Number.isNaN(major) && major > 0 ? major : m[1]}`;
    // "Android 14; SM-S918B Build/…" or "Android 14; Pixel 8)". Chrome's reduced UA says just "K".
    const fromUa = ua.match(/Android [^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\)/)?.[1]?.trim();
    model = hints.model || (fromUa && fromUa !== 'K' && !/^wv$/i.test(fromUa) ? fromUa : undefined);
  } else if ((m = ua.match(/Windows NT (\d+\.\d+)/))) {
    osFamily = 'Windows';
    os = WINDOWS[m[1]] ?? `Windows NT ${m[1]}`;
    // Windows 11 still says "Windows NT 10.0"; Client Hints tell them apart.
    const major = parseInt(hints.platformVersion ?? '', 10);
    if (m[1] === '10.0' && !Number.isNaN(major)) os = major >= 13 ? 'Windows 11' : 'Windows 10';
  } else if (/CrOS/.test(ua)) {
    osFamily = 'ChromeOS';
    os = 'ChromeOS';
  } else if (/Mac OS X/.test(ua)) {
    osFamily = 'macOS';
    const major = parseInt(hints.platformVersion ?? '', 10);
    os = !Number.isNaN(major) && major > 10 ? `macOS ${major}` : 'macOS';
  } else if (/Linux/.test(ua)) {
    osFamily = 'Linux';
    os = 'Linux';
  }

  let browserFamily = 'Other';
  let browser = 'Other';
  for (const [re, name] of BROWSERS) {
    const b = ua.match(re);
    if (b) {
      const version = b.slice(1).find(Boolean);
      browserFamily = name;
      browser = version ? `${name} ${version}` : name;
      break;
    }
  }

  let device: DeviceType = 'desktop';
  if (BOT.test(ua)) {
    device = 'bot';
    // Name the crawler ("Googlebot 2.1", "bingbot 2.0") instead of the browser it imitates.
    const bot = ua.match(/([A-Za-z-]*(?:bot|crawler|spider|preview|externalhit)[A-Za-z-]*)\/?(\d+(?:\.\d+)?)?/i);
    if (bot && !/^headless/i.test(bot[1])) {
      browserFamily = bot[1];
      browser = bot[2] ? `${bot[1]} ${bot[2]}` : bot[1];
    }
  }
  else if (osFamily === 'iPadOS' || /Tablet/i.test(ua) || (osFamily === 'Android' && !/Mobile/.test(ua) && !hints.mobile)) device = 'tablet';
  else if (/Mobi|iPhone|iPod/.test(ua) || hints.mobile) device = 'mobile';

  return { device, os, osFamily, browser, browserFamily, model };
}
