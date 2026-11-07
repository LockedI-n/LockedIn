import * as config from "../lib/config";

// Course mastery bar.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
//
// Purely visual: the mastery number is computed by the caller (see courseMastery
// in Dashboard.jsx), so the weighting rule lives in one place.
//
// Props:
//   value    0-100 mastery percent (`percent` also works, for the old stub)
//   label    accessible name, e.g. "CMPT 459 mastery"
//   showPass draw a small tick at the pass mark (default true)

const MASTERY = config.MASTERY_THRESHOLD ?? 70;

export default function MasteryBar({
                                       value,
                                       percent,
                                       label = "Mastery",
                                       showPass = true,
                                   }) {
    const raw = Number(value ?? percent ?? 0);
    const pct = Math.min(100, Math.max(0, Number.isFinite(raw) ? raw : 0));
    const reached = pct >= MASTERY;

    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-valuetext={`${Math.round(pct)}%${reached ? ", pass mark reached" : `, pass mark is ${MASTERY}%`}`}
            className="relative h-3 w-full rounded-full bg-ink/10"
        >
            <div
                className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                    reached ? "bg-brand" : "bg-coral"
                }`}
                style={{ width: `${pct}%` }}
            />
            {showPass && (
                <span
                    aria-hidden="true"
                    className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink/40"
                    style={{ left: `${MASTERY}%` }}
                />
            )}
        </div>
    );
}