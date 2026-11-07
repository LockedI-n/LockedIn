import { useEffect, useMemo, useState } from "react";
import * as config from "../lib/config";
import { loadState, saveState } from "../lib/storage";
import Sidekick from "../components/Sidekick";
import ProgressRing from "../components/ProgressRing";
import MasteryBar from "../components/MasteryBar";
import HabitCard from "../components/HabitCard";
import { courseMastery, weakTopicsByImpact } from "../lib/mastery";

const SIDEKICK_NAME = config.SIDEKICK_NAME ?? "Sparky";
const MASTERY = config.MASTERY_THRESHOLD ?? 70;

/* ---------- date helpers (local time, not UTC) ---------- */

const toISO = (d) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD
const todayISO = () => toISO(new Date());

function addDays(iso, n) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return toISO(d);
}

function daysUntil(iso) {
    const a = new Date(todayISO() + "T00:00:00");
    const b = new Date(iso + "T00:00:00");
    return Math.round((b - a) / 86400000);
}

/* ---------- progress logic ---------- */

// A habit counts 100% if the student passed the test, 50% if they only studied.
const habitProgress = (h) =>
    h.tested && (h.score ?? 0) >= MASTERY ? 100 : h.studied ? 50 : 0;

// Course mastery is weighted by grading weight: see src/lib/mastery.js.

const weakTopics = (course) =>
    (course.topics ?? [])
        .filter((t) => t.score != null && t.score < MASTERY)
        .sort((a, b) => a.score - b.score);

function nextAssessment(course) {
    return (course.weights ?? [])
        .filter((w) => w.date && daysUntil(w.date) >= 0)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
}

// Consecutive days (ending today, or yesterday if today isn't done yet) with at least one studied habit.
function computeStreak(habits) {
    const days = new Set(habits.filter((h) => h.studied).map((h) => h.date));
    let day = todayISO();
    if (!days.has(day)) day = addDays(day, -1);
    let streak = 0;
    while (days.has(day)) {
        streak += 1;
        day = addDays(day, -1);
    }
    return streak;
}

// Weak topics come first (lowest score), then topics never practiced, then the lowest score overall.
function pickTopic(course, habits) {
    const topics = course.topics ?? [];
    if (!topics.length) return null;

    // Weak topics: the one hurting the grade most comes first.
    const weak = weakTopicsByImpact(course);
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

// Make sure every course has exactly one habit for today.
function ensureTodayHabits(state) {
    const date = todayISO();
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

function normalize(raw) {
    return {
        courses: raw?.courses ?? [],
        habits: raw?.habits ?? [],
        streaks: raw?.streaks ?? {},
    };
}

/* ---------- sidekick voice ---------- */

function sidekickSays({ hasCourses, todays, dailyPct, streak, weakCount }) {
    if (!hasCourses)
        return {
            mood: "idle",
            message: `I'm ${SIDEKICK_NAME}. Add a course and upload your syllabus, and I'll plan your study days.`,
        };
    if (todays.length && dailyPct === 100)
        return {
            mood: "proud",
            message: streak > 1
                ? `All done today. That's ${streak} days in a row.`
                : "All done today. Come back tomorrow and we'll keep it going.",
        };
    if (todays.some((h) => h.studied))
        return {
            mood: "happy",
            message: "You studied. Now prove it with a test to fill your ring.",
        };
    if (weakCount > 0)
        return {
            mood: "nudge",
            message: `${weakCount} topic${weakCount > 1 ? "s" : ""} scored under ${MASTERY}. I put the weakest one first today.`,
        };
    return {
        mood: "nudge",
        message: streak > 0
            ? `You're on a ${streak}-day streak. Study one topic to keep it.`
            : "Pick a topic below and start with 20 minutes.",
    };
}

/* ---------- page ---------- */

export default function Dashboard({ onNavigate = () => {} }) {
    const [state, setState] = useState(() =>
        ensureTodayHabits(normalize(loadState()))
    );

    useEffect(() => {
        saveState(state);
    }, [state]);

    const today = todayISO();
    const courseById = useMemo(
        () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
        [state.courses]
    );

    const todays = state.habits.filter((h) => h.date === today);
    const dailyPct = todays.length
        ? Math.round(
            todays.reduce((sum, h) => sum + habitProgress(h), 0) / todays.length
        )
        : 0;
    const streak = useMemo(() => computeStreak(state.habits), [state.habits]);
    const weakCount = state.courses.reduce(
        (n, c) => n + weakTopics(c).length,
        0
    );

    const { mood, message } = sidekickSays({
        hasCourses: state.courses.length > 0,
        todays,
        dailyPct,
        streak,
        weakCount,
    });

    const markStudied = (habitId) =>
        setState((s) => ({
            ...s,
            habits: s.habits.map((h) =>
                h.id === habitId ? { ...h, studied: true } : h
            ),
        }));

    const dateLabel = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    return (
        <main className="text-ink">
            <div>
                {/* Top bar */}
                <header className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-ink/70">{dateLabel}</p>
                    <button
                        type="button"
                        onClick={() => onNavigate("upload")}
                        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                        Add course
                    </button>
                </header>

                {/* Sidekick + daily ring */}
                <section
                    aria-label="Today's progress"
                    className="mt-6 grid items-center gap-6 rounded-[2rem] bg-teal p-6 text-ink sm:grid-cols-[1fr_auto] sm:p-8"
                >
                    <div className="flex items-center gap-5">
                        <div className="w-24 shrink-0 sm:w-32">
                            <Sidekick mood={mood} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                                {message}
                            </h1>
                            <p className="mt-2 text-sm text-ink/70">
                                {streak > 0
                                    ? `${streak}-day streak`
                                    : "No streak yet. Studying today starts one."}
                            </p>
                        </div>
                    </div>

                    <div className="mx-auto flex flex-col items-center gap-2">
                        <ProgressRing value={dailyPct} size={132} />
                        <p className="text-xs text-ink/70">
                            Studied counts 50%. Passing a test counts 100%.
                        </p>
                    </div>
                </section>

                {state.courses.length === 0 ? (
                    <EmptyState onAdd={() => onNavigate("upload")} />
                ) : (
                    <>
                        {/* Today's habits */}
                        <section aria-labelledby="today-heading" className="mt-10">
                            <h2 id="today-heading" className="text-xl font-bold">
                                Study today
                            </h2>
                            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                                {todays.map((habit) => (
                                    <li key={habit.id}>
                                        <HabitCard
                                            habit={habit}
                                            course={courseById[habit.courseId]}
                                            onMarkStudied={() => markStudied(habit.id)}
                                            onTakeTest={() =>
                                                onNavigate("test", { habitId: habit.id })
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* Courses */}
                        <section aria-labelledby="courses-heading" className="mt-10 pb-12">
                            <h2 id="courses-heading" className="text-xl font-bold">
                                Your courses
                            </h2>
                            <ul className="mt-4 grid gap-4 md:grid-cols-2">
                                {state.courses.map((course) => (
                                    <li key={course.id}>
                                        <CourseCard
                                            course={course}
                                            onAddSlides={() =>
                                                onNavigate("upload", { courseId: course.id })
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}

/* ---------- local pieces ---------- */

function CourseCard({ course, onAddSlides }) {
    const mastery = courseMastery(course);
    const weak = weakTopicsByImpact(course).slice(0, 3);
    const next = nextAssessment(course);
    const left = next ? daysUntil(next.date) : null;

    return (
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold">{course.name}</h3>
                <button
                    type="button"
                    onClick={onAddSlides}
                    className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-navy ring-1 ring-navy/30 transition hover:bg-navy/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                    Add slides
                </button>
            </div>

            <div className="mt-4">
                <MasteryBar value={mastery} label={`${course.name} mastery`} />
                <p className="mt-1 text-sm text-ink/70">{mastery}% mastery</p>
            </div>

            {next && (
                <p className="mt-4 text-sm">
                    Next: <span className="font-semibold">{next.item}</span> (
                    {next.percent}% of grade){" "}
                    {left === 0 ? "is today" : `in ${left} day${left === 1 ? "" : "s"}`}
                </p>
            )}

            {weak.length > 0 ? (
                <div className="mt-4">
                    <p className="text-sm font-semibold">Needs work</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                        {weak.map((t) => (
                            <li
                                key={t.name}
                                className="rounded-full bg-coral/20 px-3 py-1 text-sm text-danger-dark"
                            >
                                {t.name} · {t.score}%
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="mt-4 text-sm text-ink/70">
                    {course.topics?.some((t) => t.score != null)
                        ? `No topics under ${MASTERY}%.`
                        : "No test scores yet. Take a test to see where you stand."}
                </p>
            )}
        </article>
    );
}

function EmptyState({ onAdd }) {
    return (
        <section className="mt-10 rounded-3xl bg-white p-8 text-center ring-1 ring-line">
            <h2 className="text-xl font-bold">No courses yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-ink/70">
                Upload a syllabus and I'll pull out your grading weights, dates, and
                topics.
            </p>
            <button
                type="button"
                onClick={onAdd}
                className="mt-5 rounded-full bg-brand px-5 py-2.5 font-bold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
                Add your first course
            </button>
        </section>
    );
}