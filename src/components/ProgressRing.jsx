import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";

// Daily progress ring. 50 = studied, 100 = passed a test.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
//
// Built for a dark background (the Dashboard hero). Pass `track` and `color`
// to use it on a light one.
//
// Props:
//   value     0-100 (`percent` also works, for the old stub)
//   size      outer size in px (default 132)
//   stroke    ring thickness in px (default 12)
//   color     progress color (default Jepi yellow)
//   track     background ring color (default translucent white)
//   label     accessible name (default "Today's progress")

export default function ProgressRing({
                                       value,
                                       percent,
                                       size = 132,
                                       stroke = 12,
                                       color = "#2FAD8F",
                                       track = "rgba(11,16,51,0.10)",
                                       label = "Today's progress",
                                     }) {
  const reduceMotion = useReducedMotion();
  const raw = Number(value ?? percent ?? 0);
  const pct = Math.min(100, Math.max(0, Number.isFinite(raw) ? raw : 0));

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  // Celebrate only when the ring fills during this visit, not when the page
  // loads with the ring already full.
  const prev = useRef(pct);
  useEffect(() => {
    if (prev.current < 100 && pct === 100 && !reduceMotion) {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.4 },
        colors: [color, "#8AD1D6", "#00FFCF", "#FE7E84"],
      });
    }
    prev.current = pct;
  }, [pct, color, reduceMotion]);

  return (
      <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          className="relative inline-flex items-center justify-center"
          style={{ width: size, height: size }}
      >
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
            aria-hidden="true"
        >
          <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={track}
              strokeWidth={stroke}
          />
          <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: reduceMotion ? offset : circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.9, ease: "easeOut" }
              }
          />
        </svg>

        <span
            className="absolute font-bold tabular-nums"
            style={{ fontSize: size * 0.26 }}
        >
        {Math.round(pct)}%
      </span>
      </div>
  );
}