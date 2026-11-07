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
    todo: { label: "Not started", badge: "bg-[#1B1740]/10 text-[#1B1740]" },
    studied: { label: "Studied · 50%", badge: "bg-[#FFD23F]/60 text-[#5C4600]" },
    retry: { label: "Needs another try", badge: "bg-[#FFE8D6] text-[#8A3B00]" },
    passed: { label: "Passed · 100%", badge: "bg-[#D9F5E3] text-[#12633A]" },
};

const primaryBtn =
    "rounded-full bg-[#FFD23F] px-4 py-2 text-sm font-bold text-[#1B1740] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B1740]";
const secondaryBtn =
    "rounded-full px-4 py-2 text-sm font-semibold text-[#4B3FD1] ring-1 ring-[#4B3FD1]/30 transition hover:bg-[#4B3FD1]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4B3FD1]";

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
        <article className="flex h-full flex-col justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#1B1740]/10">
            <div>
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-[#1B1740]/70">
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
                    <p className="mt-1 text-sm text-[#1B1740]/70">
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
                        <span className="text-sm text-[#1B1740]/60">
              Then prove it with a test.
            </span>
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
            <span className="text-sm font-semibold text-[#12633A]">
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