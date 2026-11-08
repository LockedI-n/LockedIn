import { useEffect, useMemo, useState } from "react";
import * as config from "../lib/config";
import { loadState, saveState } from "../lib/storage";
import Sidekick from "../components/Sidekick";
import ProgressRing from "../components/ProgressRing";
import MasteryBar from "../components/MasteryBar";
import HabitCard from "../components/HabitCard";
import { courseMastery, weakTopicsByImpact, topicShare } from "../lib/mastery";
import { removeCourse } from "../lib/storage";
import {
    autoShield, dailyPep, deadlineNudge, isDayOff, lastSevenDays, nextDeadline, rewards, streakLength, takeDayOff,
    MAX_HELD, REWARD_RULES,
} from "../lib/motivation";

const SIDEKICK_NAME = config.SIDEKICK_NAME ?? "Jepi";
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

// The top panel's colour follows what Jepi is saying (all from the mascot's palette).
//   panel: background + text,  ring: progress colour,  track: ring background,  note: small text
const TONES = {
    calm: { panel: "bg-teal text-ink", ring: "#2FAD8F", track: "rgba(11,16,51,0.10)", note: "text-ink/70" },
    heads: { panel: "bg-coral text-ink", ring: "#0B1033", track: "rgba(11,16,51,0.15)", note: "text-ink/75" },
    urgent: { panel: "bg-danger text-white", ring: "#FFFFFF", track: "rgba(255,255,255,0.25)", note: "text-white/85" },
    safe: { panel: "bg-navy text-white", ring: "#00FFCF", track: "rgba(255,255,255,0.2)", note: "text-white/80" },
    win: { panel: "bg-brand text-white", ring: "#FFFFFF", track: "rgba(255,255,255,0.25)", note: "text-white/85" },
};

// What Jepi says on the Dashboard. Most urgent thing first.
function sidekickSays({ state, todays, dailyPct, streak, weakCount, dayOff, shieldsUsed }) {
    if (!state.courses.length)
        return { mood: "idle", tone: "calm", message: `Hey, I'm ${SIDEKICK_NAME}! Add a course and I'll plan your study days for you.` };
    if (shieldsUsed)
        return { mood: "proud", tone: "safe", message: `You missed a day, so I used ${shieldsUsed === 1 ? "a streak shield" : `${shieldsUsed} shields`}. Your ${streak}-day streak is safe. Let's keep it going!` };
    if (dayOff) return { mood: "happy", tone: "win", message: "Day off! You earned it. Your streak is safe, so go touch grass." };
    if (todays.length && dailyPct === 100)
        return { mood: "proud", tone: "win", message: streak > 1 ? `All done! ${streak} days in a row. I'm honestly so proud of you.` : "All done today! Come back tomorrow and we'll stack the streak." };
    const deadline = deadlineNudge(state);
    if (deadline && !todays.some((h) => h.studied))
        return { mood: "nudge", tone: nextDeadline(state).days <= 1 ? "urgent" : "heads", message: deadline };
    if (todays.some((h) => h.studied && !h.tested)) return { mood: "happy", tone: "calm", message: "You studied. Now prove it with a quick test and fill that ring!" };
    if (weakCount > 0)
        return { mood: "nudge", tone: "calm", message: `${weakCount} topic${weakCount > 1 ? "s are" : " is"} under ${MASTERY}%. I put the one hurting your grade most first.` };
    if (streak > 0) return { mood: "nudge", tone: "calm", message: `${streak}-day streak on the line. One topic keeps it alive. ${dailyPep()}` };
    return { mood: "happy", tone: "calm", message: dailyPep() };
}

/* ---------- page ---------- */

export default function Dashboard({ onNavigate = () => {} }) {
    // On open: make today's habits, and spend streak shields if yesterday was missed.
    const [{ state: initial, used: shieldsUsed }] = useState(() => autoShield(ensureTodayHabits(normalize(loadState()))));
    const [state, setState] = useState(initial);

    useEffect(() => {
        saveState(state);
    }, [state]);

    const today = todayISO();
    const courseById = useMemo(
        () => Object.fromEntries(state.courses.map((c) => [c.id, c])),
        [state.courses]
    );

    const todays = state.habits.filter((h) => h.date === today);
    const dayOff = isDayOff(state);
    const dailyPct = dayOff
        ? 100
        : todays.length
            ? Math.round(todays.reduce((sum, h) => sum + habitProgress(h), 0) / todays.length)
            : 0;
    const streak = streakLength(state);
    const weakCount = state.courses.reduce(
        (n, c) => n + weakTopics(c).length,
        0
    );

    const { mood, message, tone = "calm" } = sidekickSays({ state, todays, dailyPct, streak, weakCount, dayOff, shieldsUsed });

    const deleteCourse = (course) => {
        if (window.confirm(`Delete ${course.name}? Its topics, scores and habits will be removed.`))
            setState((s) => removeCourse(s, course.id));
    };

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
                        className="hidden rounded-full bg-ink px-4 py-2 sm:inline-flex text-sm font-semibold text-white transition hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                        Add course
                    </button>
                </header>

                {/* Sidekick + daily ring */}
                <section
                    aria-label="Today's progress"
                    className={`mt-6 grid items-center gap-6 rounded-[2rem] p-6 transition-colors duration-500 sm:grid-cols-[1fr_auto] sm:p-8 ${TONES[tone].panel}`}
                >
                    <div className="flex items-center gap-5">
                        <div className="w-24 shrink-0 sm:w-32">
                            <Sidekick mood={mood} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold leading-tight sm:text-[2rem]">
                                {message}
                            </h1>
                        </div>
                    </div>

                    <div className="mx-auto flex flex-col items-center gap-2">
                        <ProgressRing value={dailyPct} size={132} color={TONES[tone].ring} track={TONES[tone].track} />
                        <p className={`max-w-[12rem] text-center text-xs ${TONES[tone].note}`}>
                            {dayOff ? "Day off. Today counts as done." : "Studied fills half. Passing a test fills it all."}
                        </p>
                    </div>
                </section>

                {state.courses.length > 0 && (
                    <StreakStrip state={state} streak={streak} dayOff={dayOff} onDayOff={() => setState((s) => takeDayOff(s))} />
                )}

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
                                {state.courses
                                    .filter((c) => !c.topics?.length)
                                    .map((c) => (
                                        <li key={`needs-${c.id}`}>
                                            <NeedsTopicsCard course={c} onAdd={() => onNavigate("upload", { courseId: c.id })} />
                                        </li>
                                    ))}
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
                                            onAddSlides={() => onNavigate("upload", { courseId: course.id })}
                                            onTest={(topic) => onNavigate("test", { courseId: course.id, topic })}
                                            onDelete={() => deleteCourse(course)}
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

// The week at a glance, plus rewards you can earn and spend.
const DAY_STYLE = {
    studied: "bg-brand text-white",
    shield: "bg-navy text-white",
    off: "bg-teal text-ink",
    today: "bg-white text-ink ring-2 ring-dashed ring-brand",
    missed: "bg-mist text-ink/40",
};
const DAY_LABEL = { studied: "Studied", shield: "Saved by a shield", off: "Day off", today: "Today", missed: "Missed" };

function StreakStrip({ state, streak, dayOff, onDayOff }) {
    const days = lastSevenDays(state);
    const r = rewards(state);
    return (
        <section aria-label="Streak and rewards" className="mt-6 grid gap-4 rounded-[2rem] bg-white p-5 ring-1 ring-line sm:p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl font-extrabold leading-none tabular">{streak}</span>
                <span className="text-sm font-semibold text-ink/70">day streak</span>
            </div>

            <ol className="flex gap-1.5 sm:gap-2" aria-label="Last 7 days">
                {days.map((d) => (
                    <li key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${DAY_LABEL[d.status]}`}>
                        <span className={`grid h-9 w-full max-w-11 place-items-center rounded-xl text-xs font-bold ${DAY_STYLE[d.status]}`}>
                            {d.status === "shield" ? <ShieldIcon /> : d.status === "off" ? <SunIcon /> : d.status === "studied" ? <CheckIcon /> : null}
                        </span>
                        <span className="text-[11px] font-medium text-ink/50">
                            {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}
                        </span>
                    </li>
                ))}
            </ol>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
                <Reward icon={<ShieldIcon />} label="Streak shields" have={r.shields} hint={r.shields >= MAX_HELD ? "Full" : `${r.toNextShield} more study day${r.toNextShield === 1 ? "" : "s"} for the next`} tone="bg-navy text-white" />
                <Reward icon={<SunIcon />} label="Days off" have={r.daysOff} hint={r.daysOff >= MAX_HELD ? "Full" : `${r.toNextDayOff} more passed test${r.toNextDayOff === 1 ? "" : "s"} for the next`} tone="bg-teal text-ink">
                    {r.daysOff > 0 && !dayOff && (
                        <button type="button" onClick={onDayOff} className="mt-2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white hover:bg-navy">
                            Take today off
                        </button>
                    )}
                </Reward>
            </div>
            <p className="text-xs text-ink/50 lg:col-span-3">{REWARD_RULES}</p>
        </section>
    );
}

function Reward({ icon, label, have, hint, tone, children }) {
    return (
        <div className="min-w-0 flex-1 rounded-2xl bg-canvas p-3 sm:min-w-[10.5rem] sm:flex-none">
            <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${tone}`}>{icon}</span>
                <span className="text-sm font-semibold">{label}</span>
                <span className="ml-auto font-display text-lg font-extrabold tabular">
                    {have}<span className="text-sm text-ink/40">/{MAX_HELD}</span>
                </span>
            </div>
            <p className="mt-1 text-xs text-ink/60">{hint}</p>
            {children}
        </div>
    );
}

const ShieldIcon = () => (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><path d="M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4Z" fill="currentColor" /></svg>
);
const SunIcon = () => (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor" /><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M13 3l-1.1 1.1M4.1 11.9 3 13" /></g></svg>
);
const CheckIcon = () => (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function CourseCard({ course, onAddSlides, onTest, onDelete }) {
    const [open, setOpen] = useState(false);
    const mastery = courseMastery(course);
    const next = nextAssessment(course);
    const left = next ? daysUntil(next.date) : null;
    const topics = course.topics ?? [];
    const scored = topics.filter((t) => t.score != null).length;
    const weak = weakTopicsByImpact(course).slice(0, 2);

    return (
        <article className="flex h-full flex-col gap-4 rounded-3xl bg-white p-5 ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-xl font-extrabold">{course.name}</h3>
                    {next && (
                        <p className={`mt-1 text-sm ${left <= 3 ? "font-semibold text-danger-dark" : "text-ink/70"}`}>
                            {next.item} ({next.percent}%) {left === 0 ? "is today" : left === 1 ? "is tomorrow" : `in ${left} days`}
                        </p>
                    )}
                </div>
                <span className="font-display text-3xl font-extrabold tabular">{mastery}%</span>
            </div>

            <div>
                <MasteryBar value={mastery} label={`${course.name} mastery`} />
                <p className="mt-1.5 text-xs text-ink/60">
                    Mastery, weighted by grades. {scored} of {topics.length} topics tested.
                </p>
            </div>

            {weak.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {weak.map((t) => (
                        <button key={t.name} type="button" onClick={() => onTest(t.name)} className="rounded-full bg-coral/20 px-3 py-1 text-sm font-medium text-danger-dark hover:bg-coral/30" title="Test this topic again">
                            {t.name} <span className="font-bold">{t.score}%</span>
                        </button>
                    ))}
                </div>
            )}

            {topics.length > 0 && (
                <div>
                    <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-semibold text-navy hover:underline" aria-expanded={open}>
                        {open ? "Hide topics" : `See all ${topics.length} topics`}
                    </button>
                    {open && (
                        <ul className="mt-3 space-y-2.5">
                            {topics.map((t) => {
                                const share = topicShare(course, t.name);
                                return (
                                    <li key={t.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                                        <span className="min-w-0 truncate text-sm">{t.name}</span>
                                        <span className={`text-sm font-semibold tabular ${t.score == null ? "text-ink/40" : t.score >= MASTERY ? "text-brand-dark" : "text-danger-dark"}`}>
                                            {t.score == null ? "not tested" : `${t.score}%`}
                                        </span>
                                        <div className="col-span-2 flex items-center gap-2">
                                            <div className="h-1.5 flex-1 rounded-full bg-mist">
                                                <div className={`h-1.5 rounded-full ${t.score >= MASTERY ? "bg-brand" : "bg-coral"}`} style={{ width: `${t.score ?? 0}%` }} />
                                            </div>
                                            {share > 0 && <span className="text-[11px] text-ink/50 tabular">{share}% of grade</span>}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
                <button type="button" onClick={onAddSlides} className="rounded-full px-3 py-1.5 text-sm font-semibold text-navy ring-1 ring-navy/30 hover:bg-navy/10">
                    Add slides
                </button>
                <button type="button" onClick={onDelete} className="ml-auto rounded-full px-3 py-1.5 text-sm font-semibold text-danger-dark hover:bg-danger/10">
                    Delete
                </button>
            </div>
        </article>
    );
}

// A course with deadlines (e.g. from Canvas) but no topics yet, so there's nothing to study or test.
function NeedsTopicsCard({ course, onAdd }) {
    return (
        <article className="flex h-full flex-col justify-between gap-4 rounded-3xl bg-cream p-5 ring-1 ring-line">
            <div>
                <p className="text-sm font-medium text-ink/70">{course.name}</p>
                <h3 className="mt-1 text-lg font-bold">Add your topics</h3>
                <p className="mt-1 text-sm text-ink/70">
                    I have your deadlines, but not what's taught each week. Upload the syllabus or lecture slides
                    and I'll plan your study days.
                </p>
            </div>
            <button
                type="button"
                onClick={onAdd}
                className="self-start rounded-full bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
                Upload syllabus or slides
            </button>
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