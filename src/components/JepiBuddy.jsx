// Jepi in the corner of every page. Tap for a pep talk or the most urgent thing to do.
// Owner: Person 3 (Dashboard, Sidekick, Progress).

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import mascot from "../assets/sidekick/mascot.svg";
import { SIDEKICK_NAME } from "../lib/config.js";
import { loadState } from "../lib/storage.js";
import { dailyPep, deadlineNudge, rewards, streakLength } from "../lib/motivation.js";

const EXTRA = [
  "Drink some water. Big brains need it.",
  "Phone face down for 20 minutes? I'll be right here.",
  "Stuck? Try explaining it to me out loud on the Test page.",
  "Tiny progress is still progress. I'm counting it.",
  "Break the topic into one question. Answer just that.",
];

function pickLine(n) {
  const state = loadState();
  const lines = [dailyPep()];
  const deadline = deadlineNudge(state);
  if (deadline) lines.unshift(deadline);
  const streak = streakLength(state);
  if (streak > 1) lines.push(`${streak} days in a row. Don't you dare break it now.`);
  const r = rewards(state);
  if (r.daysOff > 0) lines.push(`You've got ${r.daysOff} day${r.daysOff > 1 ? "s" : ""} off saved. Spend one on the Dashboard whenever you need it.`);
  lines.push(...EXTRA);
  return lines[n % lines.length];
}

export default function JepiBuddy() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);

  function tap() {
    if (open) setN((x) => x + 1);
    setOpen(true);
  }

  return (
    <div
      className="fixed z-40 flex items-end gap-2"
      style={{
        right: "max(16px, env(safe-area-inset-right, 0px))",
        bottom: "max(16px, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key={n}
            role="status"
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="relative mb-6 max-w-[16rem] rounded-2xl bg-white px-4 py-3 text-sm font-medium text-ink shadow-lg ring-1 ring-line"
          >
            {pickLine(n)}
            <div className="mt-2 flex gap-3 text-xs font-semibold">
              <button type="button" onClick={() => setN((x) => x + 1)} className="text-navy hover:underline">
                Another one
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-ink/50 hover:underline">
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        onClick={tap}
        aria-label={`Talk to ${SIDEKICK_NAME}`}
        title={`Talk to ${SIDEKICK_NAME}`}
        className="h-16 w-16 shrink-0 rounded-full bg-white p-2 shadow-lg ring-1 ring-line"
        animate={reduce ? undefined : { y: [0, -5, 0], rotate: [0, -4, 4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        whileHover={reduce ? undefined : { scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
      >
        <img src={mascot} alt="" className="h-full w-full object-contain" />
      </motion.button>
    </div>
  );
}
