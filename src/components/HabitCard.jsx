import * as config from "../lib/config";

// One habit for today (one per course per day).
// Owner: Person 3 (Dashboard, Sidekick, Progress).
//
// Props:
//   habit          { id, courseId, topic, date, studied, tested, score }
//   course         the matching course (optional, used for the course name)
//   onMarkStudied  called when the student taps "I studied"
//   onTakeTest     called when the student taps "Prove it" or "Try again"

const MASTERY = config.MASTERY_THRESHOLD ?? 70;

function getStatus(habit) {
    if (habit.tested && (habit.score ?? 0) >= MASTERY) return "passed";
    if (habit.tested) return "retry";
    if (habit.studied) return "studied";
    return "todo";
}

const STATUS = {
    todo: { label: "Not started", badge: "bg-ink/10 text-ink" },
    studied: { label: "Half done", badge: "bg-teal/60 text-ink" },
    retry: { label: "Needs another try", badge: "bg-coral/20 text-danger-dark" },
    passed: { label: "Passed", badge: "bg-brand/15 text-brand-dark" },
};

const primaryBtn =
    "rounded-full bg-brand px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const secondaryBtn =
    "rounded-full px-4 py-2 text-sm font-semibold text-navy ring-1 ring-navy/30 transition hover:bg-navy/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

export default function HabitCard({
                                      habit,
                                      course,
                                      onMarkStudied = () => {},
                                      onTakeTest = () => {},
                                  }) {
    if (!habit) return null;

    const status = getStatus(habit);
    const { label, badge } = STATUS[status];

    return (
        <article className="flex h-full flex-col justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line">
            <div>
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-ink/70">
                        {course?.name ?? habit.courseId}
                    </p>
                    <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge}`}
                    >
            {label}
          </span>
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug">{habit.topic}</h3>
                {habit.tested && (
                    <p className="mt-1 text-sm text-ink/70">
                        Score: {habit.score}%
                        {status === "retry" && ` (pass mark is ${MASTERY}%)`}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {status === "todo" && (
                    <>
                        <button type="button" onClick={onMarkStudied} className={primaryBtn}>
                            I studied
                        </button>
                        <button type="button" onClick={onTakeTest} className={secondaryBtn}>
                            Test me now
                        </button>
                    </>
                )}

                {status === "studied" && (
                    <button type="button" onClick={onTakeTest} className={primaryBtn}>
                        Prove it
                    </button>
                )}

                {status === "retry" && (
                    <button type="button" onClick={onTakeTest} className={primaryBtn}>
                        Try again
                    </button>
                )}

                {status === "passed" && (
                    <>
            <span className="text-sm font-semibold text-brand-dark">
              Done for today.
            </span>
                        <button type="button" onClick={onTakeTest} className={secondaryBtn}>
                            Practice again
                        </button>
                    </>
                )}
            </div>
        </article>
    );
}