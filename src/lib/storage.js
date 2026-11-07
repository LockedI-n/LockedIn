// localStorage helpers. All app data lives here (no database).
// Owner: Person 3 (Dashboard, Sidekick, Progress).
// localStorage helpers. All app data lives here (no database).
// Owner: Person 3 (Dashboard, Sidekick, Progress).
//
// Two kinds of exports:
//   1. load / save / clear: talk to localStorage.
//   2. Pure helpers (markStudied, recordTestResult, upsertCourse, ...): take a
//      state object and return a new one, so they work with React state.
//      Other pages can call them through updateState(), e.g.
//        updateState((s) => recordTestResult(s, { habitId, score }));

import * as config from "./config.js";

const STORAGE_KEY = config.STORAGE_KEY ?? "study-sidekick";
const MASTERY = config.MASTERY_THRESHOLD ?? 70;

// Shape: { courses: [], habits: [], streaks: {} }
export const DEFAULT_STATE = { courses: [], habits: [], streaks: {} };

/* ---------- load / save ---------- */

// Make sure a loaded object has the right shape, so old or damaged saves
// never crash the app. Unknown extra keys are kept.
export function normalizeState(raw) {
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    ...s,
    courses: Array.isArray(s.courses) ? s.courses : [],
    habits: Array.isArray(s.habits) ? s.habits : [],
    streaks:
        s.streaks && typeof s.streaks === "object" && !Array.isArray(s.streaks)
            ? s.streaks
            : {},
  };
}

// Load saved state. Returns the default state if nothing is saved or the data is broken.
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeState(null);
    return normalizeState(JSON.parse(raw));
  } catch (err) {
    console.warn("Could not load state, using default.", err);
    return normalizeState(null);
  }
}

// Save the whole state object. Returns true if it worked.
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn("Could not save state.", err);
    return false;
  }
}

// Load, change, save, and return the new state in one step.
export function updateState(updater) {
  const next = normalizeState(updater(loadState()));
  saveState(next);
  return next;
}

// Wipe everything (handy for demos).
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Could not clear state.", err);
  }
}

/* ---------- dates (local time, not UTC) ---------- */

const pad = (n) => String(n).padStart(2, "0");

export const toISO = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = () => toISO(new Date());

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/* ---------- weak-topic loop ---------- */

// Topics with a score under the pass mark, lowest first.
export const weakTopics = (course) =>
    (course.topics ?? [])
        .filter((t) => t.score != null && t.score < MASTERY)
        .sort((a, b) => a.score - b.score);

// Which topic to study next: weak topics first (lowest score), then topics never
// practiced (by week), then the lowest score overall.
export function pickTopic(course, habits = []) {
  const topics = course.topics ?? [];
  if (!topics.length) return null;

  const weak = weakTopics(course);
  if (weak.length) return weak[0].name;

  const seen = new Set(
      habits.filter((h) => h.courseId === course.id).map((h) => h.topic)
  );
  const unscored = topics
      .filter((t) => t.score == null)
      .sort(
          (a, b) =>
              (seen.has(a.name) ? 1 : 0) - (seen.has(b.name) ? 1 : 0) ||
              (a.week ?? 0) - (b.week ?? 0)
      );
  if (unscored.length) return unscored[0].name;

  return [...topics].sort((a, b) => a.score - b.score)[0].name;
}

// Make sure every course has exactly one habit for the given day.
export function ensureTodayHabits(state, date = todayISO()) {
  const created = [];
  for (const course of state.courses) {
    const exists = state.habits.some(
        (h) => h.courseId === course.id && h.date === date
    );
    if (exists) continue;
    const topic = pickTopic(course, [...state.habits, ...created]);
    if (!topic) continue;
    created.push({
      id: `${course.id}-${date}`,
      courseId: course.id,
      topic,
      date,
      studied: false,
      tested: false,
      score: null,
    });
  }
  return created.length
      ? { ...state, habits: [...state.habits, ...created] }
      : state;
}

/* ---------- updates other pages need ---------- */

// The student tapped "I studied".
export function markStudied(state, habitId) {
  return {
    ...state,
    habits: state.habits.map((h) =>
        h.id === habitId ? { ...h, studied: true } : h
    ),
  };
}

// A test or graded answer finished (Test.jsx calls this).
//   - The habit keeps the BEST score of the day, so retaking never lowers today's ring.
//   - The topic keeps the LATEST score, so mastery and weak topics reflect current knowledge.
export function recordTestResult(state, { habitId, score }) {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit || typeof score !== "number") return state;

  const best = habit.tested ? Math.max(habit.score ?? 0, score) : score;

  return {
    ...state,
    habits: state.habits.map((h) =>
        h.id === habitId
            ? { ...h, studied: true, tested: true, score: best }
            : h
    ),
    courses: state.courses.map((c) =>
        c.id === habit.courseId
            ? {
              ...c,
              topics: (c.topics ?? []).map((t) =>
                  t.name === habit.topic ? { ...t, score } : t
              ),
            }
            : c
    ),
  };
}

// A test finished on ANY topic (the Test page lets students pick a different topic
// than today's habit). Saves the topic's latest score, and counts it toward today's
// habit for that course: the habit keeps its best score of the day.
export function recordTopicScore(state, { courseId, topic, score, date = todayISO() }) {
  if (typeof score !== "number") return state;
  const habit = state.habits.find((h) => h.courseId === courseId && h.date === date);
  return {
    ...state,
    courses: state.courses.map((c) =>
        c.id === courseId
            ? { ...c, topics: (c.topics ?? []).map((t) => (t.name === topic ? { ...t, score } : t)) }
            : c
    ),
    habits: state.habits.map((h) =>
        habit && h.id === habit.id
            ? { ...h, studied: true, tested: true, score: h.tested ? Math.max(h.score ?? 0, score) : score }
            : h
    ),
  };
}

// Add a course, or replace one with the same id (Upload.jsx calls this).
// When replacing, topics that already have a score keep it (matched by name),
// so re-uploading slides doesn't wipe progress.
export function upsertCourse(state, course) {
  const old = state.courses.find((c) => c.id === course.id);
  const oldScores = Object.fromEntries(
      (old?.topics ?? []).map((t) => [t.name, t.score])
  );
  const merged = {
    ...course,
    topics: (course.topics ?? []).map((t) => ({
      ...t,
      score: t.score ?? oldScores[t.name] ?? null,
    })),
  };
  return {
    ...state,
    courses: old
        ? state.courses.map((c) => (c.id === course.id ? merged : c))
        : [...state.courses, merged],
  };
}

// Delete a course and its habits.
export function removeCourse(state, courseId) {
  return {
    ...state,
    courses: state.courses.filter((c) => c.id !== courseId),
    habits: state.habits.filter((h) => h.courseId !== courseId),
  };
}
