import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { formatTime12Hour } from '@/lib/time';
import { directionsUrl, formatDistance, haversineKm } from '@/lib/geo';
import { findNextService } from '@/lib/next-service';
import type { Locale, WorshipScheduleItem } from '@/lib/types';

/** Conversation memory the drawer sends back each turn, so follow-ups like "What about Sunday?" resolve. */
interface AskContext {
  localeId?: string;
  language?: string;
}

function getNextScheduleText(locale: Locale, language?: string): string {
  const schedule = language ? locale.schedule?.filter((s) => matchesLanguage(s, language)) : locale.schedule;
  const next = findNextService(schedule, locale.timezone);
  if (!next) return 'no schedule posted';
  return `${next.item.day_name} at ${formatTime12Hour(next.item.start_time)} (${next.item.language})`;
}

function serviceLabel(s: WorshipScheduleItem): string {
  return `${formatTime12Hour(s.start_time)} (${s.language}${s.language2 ? ` / ${s.language2}` : ''}${s.is_cws ? ', CWS' : ''})`;
}

const matchesLanguage = (s: WorshipScheduleItem, language: string) =>
  s.language.toLowerCase().includes(language.toLowerCase()) ||
  (s.language2 ?? '').toLowerCase().includes(language.toLowerCase());

// Spoken names mapped to the directory's language labels.
const LANGUAGE_ALIASES: Record<string, string> = {
  english: 'English',
  tagalog: 'Tagalog',
  filipino: 'Tagalog',
  cebuano: 'Cebuano',
  bisaya: 'Visayan',
  visayan: 'Visayan',
  ilocano: 'Ilocano',
  ilokano: 'Ilocano',
  hiligaynon: 'Hiligaynon',
  ilonggo: 'Ilonggo',
  spanish: 'Spanish',
  italian: 'Italian',
  german: 'German',
  french: 'French',
  portuguese: 'Portuguese',
  japanese: 'Nihongo',
  nihongo: 'Nihongo',
  korean: 'Korean',
  'sign language': 'Sign',
};

function mentionedLanguage(lower: string): string | undefined {
  const hit = Object.keys(LANGUAGE_ALIASES).find((alias) => new RegExp(`\\b${alias}\\b`).test(lower));
  return hit ? LANGUAGE_ALIASES[hit] : undefined;
}

// Off-topic guard — checks query is about Kapilya/worship/congregations/INC
const KAPILYA_KEYWORDS = [
  'near', 'nearest', 'chapel', 'kapilya', 'locale', 'congregation',
  'schedule', 'time', 'service', 'worship', 'thursday', 'sunday', 'friday',
  'saturday', 'wednesday', 'tuesday', 'monday', 'cws', 'direction',
  'address', 'where', 'district', 'iglesia', 'inc', 'church',
  'location', 'find', 'local', 'extension', 'ext', 'gws',
  'quezon', 'central', 'manila', 'anchorage', 'makati', 'alaska',
  'california', 'los angeles', 'sydney', 'london', 'distance',
  'tanggapan', 'pagsamba', 'lokal', 'templo', 'temple', 'region',
  'how far', 'directions', 'map', 'get to', 'visit',
];

function isKapilyaQuery(query: string): boolean {
  const lc = query.toLowerCase();
  return KAPILYA_KEYWORDS.some((kw) => lc.includes(kw));
}

const SEARCH_RADIUS_KM = 30;

export async function POST(request: NextRequest) {
  try {
    const { message, lat, lng, locationName, context: rawContext } = await request.json();
    const context: AskContext = rawContext && typeof rawContext === 'object' ? rawContext : {};

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    // 1. Off-topic guard
    if (!isKapilyaQuery(lower)) {
      return NextResponse.json({
        reply:
          "I'm your Kapilya Near Me assistant — I can only help with questions about Iglesia ni Cristo chapels, worship schedules, directions, or districts.\n\nFor example, try:\n• \"Is there an English service nearby?\"\n• \"Show services in the CENTRAL district\"\n• \"What about Sunday?\"",
        isOffTopic: true,
      });
    }

    const userLat = lat ? parseFloat(String(lat)) : 14.6644;
    const userLng = lng ? parseFloat(String(lng)) : 121.0544;
    const distanceText = (l: Locale) => formatDistance(haversineKm(userLat, userLng, l.latitude, l.longitude));
    const language = mentionedLanguage(lower) ?? context.language;
    const contextLocale = context.localeId ? kapilyaStore.getLocaleById(context.localeId) : null;

    /** Nearest locales, optionally only those holding a service in `language` (and on `day`). */
    const nearestWith = (opts: { language?: string; day?: number; limit: number }) =>
      kapilyaStore
        .searchNearby({ lat: userLat, lng: userLng, radiusKm: SEARCH_RADIUS_KM, day: opts.day, limit: 200 })
        .filter(
          (l) =>
            !opts.language ||
            l.schedule?.some((s) => matchesLanguage(s, opts.language!) && (opts.day === undefined || s.day_of_week === opts.day))
        )
        .slice(0, opts.limit);

    // --- INTENT 1: District congregation query (e.g. "congregations in CENTRAL district") ---
    const districtMatch =
      lower.match(/\bin\s+(?:the\s+)?([a-z\s\-]+?)\s+district/i) ||
      lower.match(/([a-z\s\-]+?)\s+district\b/i) ||
      lower.match(/district\s+(?:of\s+)?([a-z\s\-]+)/i);

    if (districtMatch) {
      const rawName = districtMatch[1].trim();
      const allDistricts = kapilyaStore.getDistricts();

      // Find best matching district — prioritize exact name > starts-with > contains
      const search = rawName.toLowerCase();
      const scoredDistricts = allDistricts
        .map((d) => {
          const dName = d.name.toLowerCase();
          let score = 0;
          if (dName === search) score = 100;
          else if (dName.startsWith(search + ' ')) score = 80;
          else if (search.startsWith(dName)) score = 70;
          else if (dName.includes(' ' + search) || dName.startsWith(search)) score = 50;
          else if (search.includes(dName)) score = 30;
          return { d, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      const matched = scoredDistricts.length > 0 ? scoredDistricts[0].d : null;

      if (matched) {
        const districtData = kapilyaStore.getDistrictBySlug(matched.slug);
        if (districtData && districtData.locales.length > 0) {
          // Sort locales by distance from user
          const top = districtData.locales
            .filter((l) => l.latitude && l.longitude)
            .sort(
              (a, b) =>
                haversineKm(userLat, userLng, a.latitude, a.longitude) - haversineKm(userLat, userLng, b.latitude, b.longitude)
            )
            .slice(0, 8);

          const lines = top.map(
            (l, i) => `${i + 1}. ${l.name} — ${distanceText(l)} away — next service: ${getNextScheduleText(l)}`
          );

          return NextResponse.json({
            reply: `Here are the congregations in the ${districtData.name} district nearest to you:\n\n${lines.join('\n')}\n\nThe district has ${districtData.locales.length} locales in total — browse the Districts Directory in the app for the full list.`,
            district: matched,
            context: { localeId: top[0]?.id },
          });
        }
      }

      // District not found
      return NextResponse.json({
        reply: `I couldn't find a district matching "${rawName}". Please check the spelling or try browsing the Districts Directory in the app for a full list.`,
      });
    }

    // --- INTENT 2: Directions ("Directions to the nearest one", "how do I get to Cubao") ---
    if (/\bdirections?\b|how (?:do i|to) get|get to\b|navigate/.test(lower)) {
      const named = lower
        .replace(/.*?(?:directions?|get)\s+to\s+/, '')
        .replace(/[?.!]/g, '')
        .replace(/\bthe\b|\bnearest\b|\bone\b|\bchapel\b|\bkapilya\b|\blokal\b/g, '')
        .trim();
      const target =
        (named.length > 2 &&
          kapilyaStore
            .searchNearby({ lat: userLat, lng: userLng, radiusKm: 25000, query: named, limit: 1 })[0]) ||
        (/\bnearest\b|\bclosest\b/.test(lower) ? nearestWith({ language, limit: 1 })[0] : null) ||
        contextLocale ||
        nearestWith({ language, limit: 1 })[0];

      if (target) {
        return NextResponse.json({
          reply: `${target.name}${language ? ` (holds ${language} services)` : ''} is ${distanceText(target)} away.\n\n📍 ${target.address}\n\nOpen turn-by-turn directions:\n${directionsUrl(target.latitude, target.longitude, target.name)}\n\nNext ${language ? `${language} ` : ''}service: ${getNextScheduleText(target, language)}.`,
          locale: target,
          context: { localeId: target.id, language },
        });
      }
    }

    // --- INTENT 3: Specific locale lookup by name ---
    const nameKeywords = ['where is', 'find', 'locate', 'schedule of', 'schedule for', 'address of'];
    const isNameSearch = nameKeywords.some((kw) => lower.includes(kw));

    if (isNameSearch || lower.includes('templo') || lower.includes('central temple') || lower.includes('anchorage')) {
      let searchTerm = lower;
      nameKeywords.forEach((kw) => { searchTerm = searchTerm.replace(kw, '').trim(); });
      const cleaned = searchTerm.replace(/chapel|kapilya|lokal|congregation|[?.!]/gi, '').trim();

      const matchedLocale = kapilyaStore
        .searchNearby({ lat: userLat, lng: userLng, radiusKm: 25000 })
        .find((l) => {
          const lname = l.name.toLowerCase();
          return (cleaned && lname.includes(cleaned)) || searchTerm.includes(lname);
        });

      if (matchedLocale) {
        const schedLines =
          matchedLocale.schedule?.map((s) => `• ${s.day_name}: ${serviceLabel(s)}`).join('\n') || 'No schedule posted.';

        return NextResponse.json({
          reply: `${matchedLocale.name} is located at ${matchedLocale.address}.\n\nDistance from you: ${distanceText(matchedLocale)}\n\nWorship Schedule:\n${schedLines}${matchedLocale.phone ? `\n\nPhone: ${matchedLocale.phone}` : ''}`,
          locale: matchedLocale,
          context: { localeId: matchedLocale.id, language },
        });
      }
    }

    // --- INTENT 4: Day-specific schedule query ("What about Sunday?") ---
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const mentionedDay = Object.keys(days).find((d) => lower.includes(d));

    if (mentionedDay) {
      const dayNum = days[mentionedDay];
      const dayCapitalized = mentionedDay.charAt(0).toUpperCase() + mentionedDay.slice(1);
      const dayServices = (l: Locale) =>
        (l.schedule ?? []).filter((s) => s.day_of_week === dayNum && (!language || matchesLanguage(s, language)));

      // Follow-up about the congregation we were just discussing.
      let intro = '';
      if (contextLocale) {
        const services = dayServices(contextLocale);
        if (services.length > 0) {
          return NextResponse.json({
            reply: `On ${dayCapitalized}, ${contextLocale.name} holds${language ? ` ${language}` : ''} worship service${services.length > 1 ? 's' : ''} at:\n\n${services.map((s) => `• ${serviceLabel(s)}`).join('\n')}\n\nIt's ${distanceText(contextLocale)} away.`,
            locale: contextLocale,
            context: { localeId: contextLocale.id, language },
          });
        }
        intro = `${contextLocale.name} has no${language ? ` ${language}` : ''} service on ${dayCapitalized}. `;
      }

      const nearby = nearestWith({ language, day: dayNum, limit: 6 }).filter((l) => dayServices(l).length > 0);
      if (nearby.length > 0) {
        const lines = nearby.map(
          (l, i) => `${i + 1}. ${l.name} — ${distanceText(l)} away\n   ${dayCapitalized}: ${dayServices(l).map(serviceLabel).join(', ')}`
        );
        return NextResponse.json({
          reply: `${intro}Here are chapels near you${locationName ? ` (near ${locationName})` : ''} with ${language ? `${language} ` : ''}${dayCapitalized} worship services:\n\n${lines.join('\n\n')}`,
          context: { localeId: nearby[0].id, language },
        });
      }

      return NextResponse.json({
        reply: `${intro}I couldn't find congregations with ${language ? `${language} ` : ''}${dayCapitalized} services within ${SEARCH_RADIUS_KM} km of your current location. Try changing your location in the app.`,
        context: { language },
      });
    }

    // --- INTENT 5: Language query ("Is there an English service nearby?") ---
    if (language && mentionedLanguage(lower)) {
      const nearby = nearestWith({ language, limit: 5 });
      if (nearby.length > 0) {
        const lines = nearby.map((l, i) => {
          const services = (l.schedule ?? []).filter((s) => matchesLanguage(s, language));
          const byDay = [1, 2, 3, 4, 5, 6, 0]
            .map((d) => services.filter((s) => s.day_of_week === d))
            .filter((g) => g.length > 0)
            .map((g) => `${g[0].day_name.slice(0, 3)} ${g.map((s) => formatTime12Hour(s.start_time)).join(', ')}`)
            .join(' · ');
          return `${i + 1}. ${l.name} — ${distanceText(l)} away\n   ${byDay}`;
        });
        return NextResponse.json({
          reply: `Yes — here are the nearest chapels with ${language} worship services${locationName ? ` (near ${locationName})` : ''}:\n\n${lines.join('\n\n')}`,
          context: { localeId: nearby[0].id, language },
        });
      }
      return NextResponse.json({
        reply: `I couldn't find a ${language} worship service within ${SEARCH_RADIUS_KM} km of your current location. Try changing your location in the app, or open the Near Me map and widen the radius.`,
        context: { language },
      });
    }

    // --- INTENT 6: General "near me" / nearby query ---
    const nearby = nearestWith({ language, limit: 5 });

    if (nearby.length > 0) {
      const lines = nearby.map(
        (l, i) => `${i + 1}. ${l.name} — ${distanceText(l)} away — next service: ${getNextScheduleText(l)}`
      );

      const locationLabel = locationName ? ` near ${locationName}` : '';

      return NextResponse.json({
        reply: `Here are the nearest Kapilya congregations${locationLabel}:\n\n${lines.join('\n')}\n\nYou can tap any row in the Near Me view for full departure-board schedules and GPS directions.`,
        context: { localeId: nearby[0].id, language },
      });
    }

    return NextResponse.json({
      reply: `I couldn't locate a congregation within your immediate area${locationName ? ` (${locationName})` : ''}. Please try:\n• Changing your location using the "My Location" button in the menu bar\n• Searching by district name (e.g., "congregations in CENTRAL district")\n• Opening the Near Me map for a broader search`,
    });
  } catch (err: unknown) {
    console.error('API ask error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
