// The sidekick character. Shows up on every screen with a message.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
// TODO: swap the circle for mood images in src/assets/sidekick and animate with framer-motion.

import { SIDEKICK_NAME } from "../lib/config.js";

export default function Sidekick({ message = `Hi! I'm ${SIDEKICK_NAME}.`, mood = "happy" }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-16 w-16 shrink-0 rounded-full bg-amber-400 shadow-lg shadow-amber-400/30"
        title={`${SIDEKICK_NAME} (${mood})`}
      />
      <div className="rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-100">{message}</div>
    </div>
  );
}
