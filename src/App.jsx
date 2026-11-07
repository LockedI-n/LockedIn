// App shell: logo, tabs, and the current page. Also the glue between pages:
// navigation (with which course/topic to open) and saving test results.
// Owner: shared. Keep this small; real UI lives in pages/ and components/.

import { useState } from "react";
import mascot from "./assets/sidekick/mascot.svg";
import Dashboard from "./pages/Dashboard.jsx";
import Test from "./pages/Test.jsx";
import Upload from "./pages/Upload.jsx";
import { SIDEKICK_NAME } from "./lib/config.js";
import { loadState, updateState, recordTopicScore } from "./lib/storage.js";

const TABS = ["Dashboard", "Add course", "Test"];

// Pages call onNavigate with either the tab label or a short name.
const ALIASES = { dashboard: "Dashboard", upload: "Add course", "add course": "Add course", test: "Test" };
const tabFor = (name) => ALIASES[String(name).toLowerCase()] ?? "Dashboard";

export default function App() {
  // nav = { page, params, n }. n changes on every navigation so the page restarts fresh.
  const [nav, setNav] = useState({ page: "Dashboard", params: {}, n: 0 });

  const onNavigate = (name, params = {}) => {
    setNav((prev) => ({ page: tabFor(name), params, n: prev.n + 1 }));
    window.scrollTo?.(0, 0);
  };

  // Save a finished test: topic score + today's habit for that course.
  const onTestComplete = ({ courseId, topic, score }) => {
    updateState((s) => recordTopicScore(s, { courseId, topic, score }));
  };

  function renderPage() {
    const { page, params, n } = nav;
    if (page === "Dashboard") return <Dashboard key={n} onNavigate={onNavigate} />;
    if (page === "Add course") return <Upload key={n} initialCourseId={params.courseId} onNavigate={onNavigate} />;

    // Test: open the habit's course and topic when coming from "Prove it".
    const state = loadState();
    const habit = params.habitId ? state.habits.find((h) => h.id === params.habitId) : null;
    return (
      <Test
        key={n}
        courses={state.courses}
        initialCourseId={habit?.courseId ?? params.courseId}
        initialTopic={habit?.topic ?? params.topic}
        onComplete={onTestComplete}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className={`mx-auto space-y-6 px-4 py-8 ${nav.page === "Dashboard" ? "max-w-5xl" : "max-w-2xl"}`}>
        <header className="flex items-center gap-3">
          <img src={mascot} alt={SIDEKICK_NAME} className="h-10 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight">
            Locked<span className="text-amber-400">In</span>
          </h1>
        </header>

        <nav className="flex flex-wrap gap-2">
          {TABS.map((name) => (
            <button
              key={name}
              onClick={() => onNavigate(name)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                name === nav.page ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {name}
            </button>
          ))}
        </nav>

        <main>{renderPage()}</main>
      </div>
    </div>
  );
}
