// Test: prove you studied with MCQ, Written, or Feynman mode.
// Owner: Person 4 (Test Modes and Pitch).
// TODO: call getQuiz and gradeAnswer from lib/api.js, then update the habit score.

import { useState } from "react";

const MODES = ["MCQ", "Written", "Feynman"];

export default function Test() {
  const [mode, setMode] = useState("MCQ");
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Test</h2>
      <div className="flex gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-3 py-1 text-sm ${m === mode ? "bg-amber-400 text-slate-950" : "bg-slate-800"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <p className="text-slate-400">{mode} mode goes here.</p>
    </section>
  );
}
