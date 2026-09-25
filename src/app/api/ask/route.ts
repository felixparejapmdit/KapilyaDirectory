import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { formatTime12Hour } from '@/lib/time';
import { NEARBY_POOL, NEARBY_RADIUS_KM, directionsUrl, formatTravel, haversineKm } from '@/lib/geo';
import { roadDistances, type RoadDistance } from '@/lib/road-distance';
import { estimateTravelMinutes, findNextService, findReachableService, formatLeaveIn } from '@/lib/next-service';
import { matchDistricts, matchLocales } from '@/lib/entity-search';
import type { Locale, LocaleKind, WorshipScheduleItem } from '@/lib/types';

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

/** Markdown link the Ask drawer renders as a link to the congregation's details page. */
function link(l: Pick<Locale, 'id' | 'name'>): string {
  return `[${l.name.replace(/[\[\]]/g, '')}](/locales/${l.id})`;
}

const KIND_LABELS: Record<LocaleKind, string> = {
  local_congregation: 'local congregations',
  extension: 'extensions',
  group_worship_service: 'group worship services (GWS)',
};

function mentionedKind(lower: string): LocaleKind | undefined {
  if (/\b(gws|group worship)/.test(lower)) return 'group_worship_service';
  if (/\b(ext|extensions?)\b/.test(lower)) return 'extension';
  if (/\blocal (congregations?|chapels?)\b|\blokal\b/.test(lower)) return 'local_congregation';
  return undefined;
}

function kindTag(l: Locale): string {
  return l.kind === 'group_worship_service' ? ' (GWS)' : l.kind === 'extension' ? ' (Ext)' : '';
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
  'location', 'find', 'local', 'extension', 'ext', 'gws', 'group worship',
  'quezon', 'central', 'manila', 'anchorage', 'makati', 'alaska',
  'california', 'los angeles', 'sydney', 'london', 'distance',
  'tanggapan', 'pagsamba', 'lokal', 'templo', 'temple', 'region',
  'how far', 'directions', 'map', 'get to', 'visit',
];

function isKapilyaQuery(query: string): boolean {
  const lc = query.toLowerCase();
  return KAPILYA_KEYWORDS.some((kw) => lc.includes(kw));
}

const SEARCH_RADIUS_KM = NEARBY_RADIUS_KM;

/** Structured result for the voice overlay / UI cards (the reply text stays the source of truth). */
interface ResultCard {
  id: string;
  name: string;
  kind: LocaleKind;
  district?: string;
  distance: string;
  next: string;
  leave?: string;
  directions: string;
}

const SOONEST_PATTERN = /\b(soonest|earliest|next (worship )?service|next worship|starting soon|start(s|ing)? soon|can i (still )?(make|catch|attend)|right now|pinakamaagang|susunod na pagsamba)\b/;

export async function POST(request: NextRequest) {
  try {
    const { message, lat, lng, locationName, context: rawContext } = await request.json();
    const context: AskContext = rawContext && typeof rawContext === 'object' ? rawContext : {};

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    const userLat = lat ? parseFloat(String(lat)) : 14.6644;
    const userLng = lng ? parseFloat(String(lng)) : 121.0544;
    const origin = { lat: userLat, lng: userLng };

    // Names anywhere in the question, tolerant of typos and speech errors ("Bonifacio the vibe" ->
    // Bonifacio Drive). Near-ties go to the congregation closest to the user.
    const nameIndex = kapilyaStore.getNameIndex();
    const nameMatches = matchLocales(nameIndex, trimmed, origin, 0.6);
    // A clear request about a place ("... schedule", "directions to ...") accepts a looser match,
    // since speech often garbles part of the name.
    const asksAboutPlace = /\b(schedules?|iskedyul|worship|services?|pagsamba|times?|oras|directions?|where|address|located|phone|contact)\b/.test(lower);
    const topName = nameMatches[0];
    const districtByName = matchDistricts(nameIndex, trimmed, 0.9)[0] ?? null;
    const namedLocale =
      topName &&
      topName.score >= (asksAboutPlace ? 0.62 : 0.75) &&
      // "Services in Quezon City": a district name that matches at least as well wins.
      !(districtByName && districtByName.score >= topName.score)
        ? kapilyaStore.getLocaleById(topName.item.id)
        : null;
    const sameNameElsewhere = namedLocale
      ? nameMatches
          .slice(1, 6)
          .filter((m) => m.score >= nameMatches[0].score - 0.01 && m.item.district_id !== namedLocale.district_id)
          .map((m) => kapilyaStore.getLocaleById(m.item.id)!)
          .slice(0, 3)
      : [];

    // 1. Off-topic guard (a recognised congregation or district name is always on topic)
    if (!isKapilyaQuery(lower) && !namedLocale && !districtByName) {
      return NextResponse.json({
        reply:
          "I'm your Kapilya Near Me assistant — I can only help with questions about Iglesia ni Cristo chapels, worship schedules, directions, or districts.\n\nFor example, try:\n• \"Is there an English service nearby?\"\n• \"Show services in the CENTRAL district\"\n• \"What about Sunday?\"",
        isOffTopic: true,
      });
    }

    // Distances are driving distances (what "Get directions" shows), straight-line only as a fallback.
    const roadMap = new Map<string, RoadDistance | null>();
    const measure = async (list: Locale[]) => {
      const todo = list.filter((l) => !roadMap.has(l.id));
      const roads = await roadDistances(origin, todo.map((l) => ({ lat: l.latitude, lng: l.longitude })));
      todo.forEach((l, i) => roadMap.set(l.id, roads[i]));
      return list;
    };
    const straightKm = (l: Locale) => haversineKm(userLat, userLng, l.latitude, l.longitude);
    const roadKm = (l: Locale) => roadMap.get(l.id)?.km ?? straightKm(l);
    // Exactly what the web page shows: "2.4 km · 4 min", "Here", or "≈1.5 km" without a route.
    const distanceText = (l: Locale) => formatTravel(roadMap.get(l.id), straightKm(l));
    /** Distance in a sentence: "is 2.4 km · 4 min from you" / "is right where you are". */
    const distanceSentence = (l: Locale) =>
      (roadMap.get(l.id)?.km ?? 1) < 0.03 ? 'right where you are' : `${distanceText(l)} from you`;
    const language = mentionedLanguage(lower) ?? context.language;
    const contextLocale = context.localeId ? kapilyaStore.getLocaleById(context.localeId) : null;

    /** Nearest locales, optionally only those holding a service in `language` (and on `day`). */
    const kind = mentionedKind(lower);
    const kindText = kind ? KIND_LABELS[kind] : 'chapels';
    // Straight-line candidates, re-ranked by road distance (the nearest by road can differ).
    const nearestWith = async (opts: { language?: string; day?: number; limit: number }) => {
      const candidates = kapilyaStore
        .searchNearby({ lat: userLat, lng: userLng, radiusKm: SEARCH_RADIUS_KM, day: opts.day, kind, limit: 200 })
        .filter(
          (l) =>
            !opts.language ||
            l.schedule?.some((s) => matchesLanguage(s, opts.language!) && (opts.day === undefined || s.day_of_week === opts.day))
        )
        .slice(0, NEARBY_POOL);
      await measure(candidates);
      return candidates.sort((a, b) => roadKm(a) - roadKm(b)).slice(0, opts.limit);
    };

    const travelMinutes = (l: Locale) => roadMap.get(l.id)?.minutes ?? estimateTravelMinutes(straightKm(l));
    const cardFor = (l: Locale, extra: Partial<ResultCard> = {}): ResultCard => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      district: l.district_name,
      distance: distanceText(l),
      next: getNextScheduleText(l),
      directions: directionsUrl(l.latitude, l.longitude, l.name, origin),
      ...extra,
    });
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const dayNow = new Date().getDay();
    const mentionedDay = /\btoday\b|\bngayon\b/.test(lower)
      ? Object.keys(days)[dayNow]
      : /\btomorrow\b|\bbukas\b/.test(lower)
        ? Object.keys(days)[(dayNow + 1) % 7]
        : Object.keys(days).find((d) => lower.includes(d));
    const asksNearest = /\b(nearest|closest|near me|nearby|pinakamalapit|malapit)\b/.test(lower);

    // --- INTENT 1: District congregation query (e.g. "congregations in CENTRAL district") ---
    const districtMatch =
      lower.match(/\bin\s+(?:the\s+)?([a-z\s\-]+?)\s+district/i) ||
      lower.match(/([a-z\s\-]+?)\s+district\b/i) ||
      lower.match(/district\s+(?:of\s+)?([a-z\s\-]+)/i);
    // A district named without the word "district" ("services in Quezon City").
    const districtOnlyByName = !districtMatch && !namedLocale && districtByName && !asksNearest && !SOONEST_PATTERN.test(lower);

    if (districtMatch || districtOnlyByName) {
      const rawName = districtMatch ? districtMatch[1].trim() : districtByName!.item.name.toLowerCase();
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

      const matched = scoredDistricts.length > 0 ? scoredDistricts[0].d : (matchDistricts(nameIndex, rawName)[0]?.item ?? null);

      if (matched) {
        const districtData = kapilyaStore.getDistrictBySlug(matched.slug);
        if (districtData && districtData.locales.length > 0) {
          // Sort locales by distance from user
          const candidates = districtData.locales
            .filter((l) => l.latitude && l.longitude && (!kind || l.kind === kind))
            .sort((a, b) => straightKm(a) - straightKm(b))
            .slice(0, 14);
          await measure(candidates);
          const top = candidates.sort((a, b) => roadKm(a) - roadKm(b)).slice(0, 8);

          const lines = top.map(
            (l, i) => `${i + 1}. ${link(l)}${kindTag(l)} — ${distanceText(l)} — next service: ${getNextScheduleText(l)}`
          );
          if (!top.length) {
            return NextResponse.json({ reply: `The ${districtData.name} district has no ${kindText} listed.` });
          }

          return NextResponse.json({
            reply: `Here are the ${kind ? KIND_LABELS[kind] : 'congregations'} in the ${districtData.name} district nearest to you:\n\n${lines.join('\n')}\n\nThe district has ${districtData.locales.length} locales in total — browse the Districts Directory in the app for the full list.`,
            district: matched,
            cards: top.map((l) => cardFor(l)),
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
      const target =
        namedLocale ||
        (asksNearest ? (await nearestWith({ language, limit: 1 }))[0] : null) ||
        contextLocale ||
        (await nearestWith({ language, limit: 1 }))[0];

      if (target) {
        await measure([target]);
        return NextResponse.json({
          reply: `${link(target)}${kindTag(target)}${language ? ` (holds ${language} services)` : ''} is ${distanceSentence(target)}.\n\n📍 ${target.address}\n\nOpen turn-by-turn directions:\n${directionsUrl(target.latitude, target.longitude, target.name, origin)}\n\nNext ${language ? `${language} ` : ''}service: ${getNextScheduleText(target, language)}.`,
          locale: target,
          cards: [cardFor(target)],
          context: { localeId: target.id, language },
        });
      }
    }

    // --- INTENT 3: A named congregation (schedule, that day's services, address, distance) ---
    if (namedLocale && !asksNearest) {
      await measure([namedLocale]);
      const sched = namedLocale.schedule ?? [];
      const dayNum = mentionedDay !== undefined ? days[mentionedDay] : undefined;
      const shown = dayNum === undefined ? sched : sched.filter((s) => s.day_of_week === dayNum);
      const dayName = mentionedDay ? mentionedDay.charAt(0).toUpperCase() + mentionedDay.slice(1) : '';
      const schedLines = shown.length
        ? [1, 2, 3, 4, 5, 6, 0]
            .map((d) => shown.filter((s) => s.day_of_week === d))
            .filter((g) => g.length)
            .map((g) => `• ${g[0].day_name}: ${g.map(serviceLabel).join(', ')}`)
            .join('\n')
        : dayNum === undefined
          ? 'No schedule is posted in the official directory. Please check with the district office.'
          : `No worship service on ${dayName}.`;
      const next = getNextScheduleText(namedLocale);
      const others = sameNameElsewhere.length
        ? `\n\nDid you mean another one? ${sameNameElsewhere.map((l) => `${link(l)} (${l.district_name})`).join(', ')}`
        : '';

      return NextResponse.json({
        reply: `${link(namedLocale)}${kindTag(namedLocale)} (${namedLocale.district_name}) is ${distanceSentence(namedLocale)}.\n📍 ${namedLocale.address}\n\n${dayName ? `${dayName} worship services` : 'Worship schedule'}:\n${schedLines}\n\nNext service: ${next}.${namedLocale.phone ? `\n\nPhone: ${namedLocale.phone}` : ''}${others}`,
        locale: namedLocale,
        cards: [cardFor(namedLocale)],
        context: { localeId: namedLocale.id, language },
      });
    }

    // --- INTENT 3b: Soonest service you can still make (travel time included) ---
    if (SOONEST_PATTERN.test(lower)) {
      const pool = await nearestWith({ language, limit: NEARBY_POOL });
      const ranked = pool
        .map((l) => {
          const schedule = language ? l.schedule?.filter((s) => matchesLanguage(s, language)) : l.schedule;
          return { l, r: findReachableService(schedule, l.timezone, travelMinutes(l)) };
        })
        .filter((x) => x.r)
        .sort((a, b) => a.r!.startsInMinutes - b.r!.startsInMinutes)
        .slice(0, 5);
      if (ranked.length) {
        const lines = ranked.map(
          ({ l, r }, i) =>
            `${i + 1}. ${link(l)}${kindTag(l)} — ${r!.item.day_name} ${formatTime12Hour(r!.item.start_time)} (${r!.item.language}) · ${formatLeaveIn(r!.leaveInMinutes)} · ${distanceText(l)}`
        );
        return NextResponse.json({
          reply: `The soonest ${language ? `${language} ` : ''}worship services you can still make${locationName ? ` from ${locationName}` : ''}, counting travel time:\n\n${lines.join('\n')}`,
          cards: ranked.map(({ l, r }) =>
            cardFor(l, {
              next: `${r!.item.day_name} ${formatTime12Hour(r!.item.start_time)} (${r!.item.language})`,
              leave: formatLeaveIn(r!.leaveInMinutes),
            })
          ),
          context: { localeId: ranked[0].l.id, language },
        });
      }
    }

    // --- INTENT 4: Day-specific schedule query ("What about Sunday?") ---
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
          await measure([contextLocale]);
          return NextResponse.json({
            reply: `On ${dayCapitalized}, ${link(contextLocale)} holds${language ? ` ${language}` : ''} worship service${services.length > 1 ? 's' : ''} at:\n\n${services.map((s) => `• ${serviceLabel(s)}`).join('\n')}\n\nIt's ${distanceSentence(contextLocale)}.`,
            locale: contextLocale,
            context: { localeId: contextLocale.id, language },
          });
        }
        intro = `${link(contextLocale)} has no${language ? ` ${language}` : ''} service on ${dayCapitalized}. `;
      }

      const nearby = (await nearestWith({ language, day: dayNum, limit: 6 })).filter((l) => dayServices(l).length > 0);
      if (nearby.length > 0) {
        const lines = nearby.map(
          (l, i) => `${i + 1}. ${link(l)}${kindTag(l)} — ${distanceText(l)}\n   ${dayCapitalized}: ${dayServices(l).map(serviceLabel).join(', ')}`
        );
        return NextResponse.json({
          reply: `${intro}Here are ${kindText} near you${locationName ? ` (near ${locationName})` : ''} with ${language ? `${language} ` : ''}${dayCapitalized} worship services:\n\n${lines.join('\n\n')}`,
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
      const nearby = await nearestWith({ language, limit: 5 });
      if (nearby.length > 0) {
        const lines = nearby.map((l, i) => {
          const services = (l.schedule ?? []).filter((s) => matchesLanguage(s, language));
          const byDay = [1, 2, 3, 4, 5, 6, 0]
            .map((d) => services.filter((s) => s.day_of_week === d))
            .filter((g) => g.length > 0)
            .map((g) => `${g[0].day_name.slice(0, 3)} ${g.map((s) => formatTime12Hour(s.start_time)).join(', ')}`)
            .join(' · ');
          return `${i + 1}. ${link(l)}${kindTag(l)} — ${distanceText(l)}\n   ${byDay}`;
        });
        return NextResponse.json({
          reply: `Yes — here are the nearest ${kindText} with ${language} worship services${locationName ? ` (near ${locationName})` : ''}:\n\n${lines.join('\n\n')}`,
          context: { localeId: nearby[0].id, language },
        });
      }
      return NextResponse.json({
        reply: `I couldn't find a ${language} worship service within ${SEARCH_RADIUS_KM} km of your current location. Try changing your location in the app, or open the Near Me map and widen the radius.`,
        context: { language },
      });
    }

    // --- INTENT 6: General "near me" / nearby query ---
    const nearby = await nearestWith({ language, limit: 5 });

    if (nearby.length > 0) {
      const lines = nearby.map(
        (l, i) => `${i + 1}. ${link(l)}${kindTag(l)} — ${distanceText(l)} — next service: ${getNextScheduleText(l)}`
      );

      const locationLabel = locationName ? ` near ${locationName}` : '';

      return NextResponse.json({
        reply: `Here are the nearest ${kind ? KIND_LABELS[kind] : 'Kapilya congregations'}${locationLabel}:\n\n${lines.join('\n')}\n\nTap a name for its full schedule and directions.`,
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
