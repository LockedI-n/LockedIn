// Streaks, rewards and Jepi's pep talk.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
//
// Rewards are worked out from your history, so they can't be double-counted:
//   Streak shield: earned every SHIELD_EVERY days you study. If you miss a day, a shield is
//                  used automatically so your streak survives. Hold up to MAX_HELD.
//   Day off:       earned every DAYOFF_EVERY tests you pass. Spend one to take today off;
//                  today still counts for your streak. Hold up to MAX_HELD.
// Used ones are remembered in state.streaks: { shieldDays: [dates], offDays: [dates] }.

import { MASTERY_THRESHOLD, SIDEKICK_NAME } from "./config.js";
import { todayISO, addDays } from "./storage.js";

export const SHIELD_EVERY = 5;
export const DAYOFF_EVERY = 3;
export const MAX_HELD = 3;

const list = (x) => (Array.isArray(x) ? x : []);

export function rewards(state) {
  const streaks = state.streaks ?? {};
  const shieldDays = list(streaks.shieldDays);
  const offDays = list(streaks.offDays);
  const studiedDays = new Set(state.habits.filter((h) => h.studied).map((h) => h.date));
  const passes = state.habits.filter((h) => h.tested && (h.score ?? 0) >= MASTERY_THRESHOLD).length;

  const shieldsEarned = Math.floor(studiedDays.size / SHIELD_EVERY);
  const daysOffEarned = Math.floor(passes / DAYOFF_EVERY);
  return {
    shields: Math.max(0, Math.min(MAX_HELD, shieldsEarned - shieldDays.length)),
    daysOff: Math.max(0, Math.min(MAX_HELD, daysOffEarned - offDays.length)),
    toNextShield: SHIELD_EVERY - (studiedDays.size % SHIELD_EVERY),
    toNextDayOff: DAYOFF_EVERY - (passes % DAYOFF_EVERY),
    shieldDays,
    offDays,
  };
}

// Days that count for the streak: studied, shielded, or taken off.
function coveredDays(state) {
  const { shieldDays, offDays } = rewards(state);
  return new Set([...state.habits.filter((h) => h.studied).map((h) => h.date), ...shieldDays, ...offDays]);
}

// Consecutive covered days ending today (or yesterday, if today isn't done yet).
export function streakLength(state, today = todayISO()) {
  const days = coveredDays(state);
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

// Status of each of the last 7 days, oldest first: "studied" | "shield" | "off" | "missed" | "today".
export function lastSevenDays(state, today = todayISO()) {
  const studied = new Set(state.habits.filter((h) => h.studied).map((h) => h.date));
  const { shieldDays, offDays } = rewards(state);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const status = studied.has(date)
      ? "studied"
      : offDays.includes(date)
        ? "off"
        : shieldDays.includes(date)
          ? "shield"
          : date === today
            ? "today"
            : "missed";
    return { date, status };
  });
}

// If the student missed day(s) right before today but has enough shields to bridge back to
// their streak, spend them. Returns { state, used } (used = number of shields spent).
export function autoShield(state, today = todayISO()) {
  const days = coveredDays(state);
  const missed = [];
  let day = addDays(today, -1);
  while (!days.has(day) && missed.length <= MAX_HELD) {
    missed.push(day);
    day = addDays(day, -1);
  }
  const { shields } = rewards(state);
  // Nothing missed, no streak to save, or not enough shields to bridge the gap.
  if (!missed.length || !days.has(day) || missed.length > shields) return { state, used: 0 };
  const streaks = { ...(state.streaks ?? {}), shieldDays: [...rewards(state).shieldDays, ...missed] };
  return { state: { ...state, streaks }, used: missed.length };
}

export function takeDayOff(state, today = todayISO()) {
  const r = rewards(state);
  if (r.daysOff < 1 || r.offDays.includes(today)) return state;
  return { ...state, streaks: { ...(state.streaks ?? {}), offDays: [...r.offDays, today] } };
}

export const isDayOff = (state, today = todayISO()) => rewards(state).offDays.includes(today);

// A different pep line each day (same all day, so it doesn't flicker).
const PEP = [
  "Future you is going to be so smug about this. Let's make them proud.",
  "You don't need motivation, you need 20 minutes. I'll time it with you.",
  "Small reps every day beat one panic night. Every time.",
  "Pretend it's someone else's exam. Way less scary, right? Now go.",
  "Open the slides. That's it, that's the whole first step.",
  "Your brain grows when it's confused. Being stuck means it's working.",
  "Nobody remembers the night you crammed. Everyone remembers the A.",
  "One topic. One quiz. Then you can scroll guilt-free.",
  "You've literally done harder things than this chapter.",
  "Locked in mode: phone face down, me on screen. Let's go.",
];
export function dailyPep(today = todayISO()) {
  const n = [...today].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return PEP[n % PEP.length];
}

// The closest upcoming graded item across all courses.
export function nextDeadline(state, today = todayISO()) {
  const daysUntil = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
  return state.courses
    .flatMap((c) => (c.weights ?? []).filter((w) => w.date).map((w) => ({ ...w, course: c.name, days: daysUntil(w.date) })))
    .filter((w) => w.days >= 0)
    .sort((a, b) => a.days - b.days)[0];
}

// A short line about the nearest deadline, or null if nothing is close.
export function deadlineNudge(state, today = todayISO()) {
  const d = nextDeadline(state, today);
  if (!d || d.days > 7) return null;
  const when = d.days === 0 ? "today" : d.days === 1 ? "tomorrow" : `in ${d.days} days`;
  if (d.days <= 2) return `${d.course} ${d.item} is ${when} (${d.percent}%). 20 focused minutes now saves you a 2am panic.`;
  return `${d.course} ${d.item} is ${when}. A little every day and you'll walk in calm.`;
}

export const REWARD_RULES = `Every ${SHIELD_EVERY} days you study earns a streak shield. Every ${DAYOFF_EVERY} tests you pass earns a day off. ${SIDEKICK_NAME} holds up to ${MAX_HELD} of each for you.`;
