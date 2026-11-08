// Import grading weights and due dates from Canvas with a personal access token.
// The token stays in this component's memory only. It is never saved.
// Owner: Person 1 (Uploads and Content).

import { useState } from "react";
import { canvasCourses, canvasCourse } from "../../lib/api.js";
import { CANVAS_DEFAULT_URL, CANVAS_TUTORIAL_URL } from "../../lib/config.js";

const URL_KEY = "lockedin-canvas-url";
const savedUrl = () => {
  try {
    return localStorage.getItem(URL_KEY) || CANVAS_DEFAULT_URL;
  } catch {
    return CANVAS_DEFAULT_URL;
  }
};

// onImportAll(courses) gets every imported course: [{ name, weights }]. Each is saved as its own course.
export default function CanvasPanel({ busy, setBusy, onImportAll, onError }) {
  const [baseUrl, setBaseUrl] = useState(savedUrl);
  const [token, setToken] = useState("");
  const [courses, setCourses] = useState(null);
  const [status, setStatus] = useState({}); // canvas id -> "added" | "skipped" | "failed"
  const [showHelp, setShowHelp] = useState(false);

  async function loadCourses(e) {
    e.preventDefault();
    setBusy("Connecting to Canvas...");
    try {
      const { courses } = await canvasCourses({ baseUrl, token: token.trim() });
      setCourses(courses);
      try {
        localStorage.setItem(URL_KEY, baseUrl);
      } catch {
        // remembering the address is only a convenience
      }
      if (!courses.length) {
        onError("Canvas didn't return any active courses for this account.");
        return;
      }
      await importAll(courses);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy("");
    }
  }

  // Import every course. Courses with no graded work (clubs, co-op hubs) are skipped.
  async function importAll(list) {
    const imported = [];
    const next = {};
    for (const [i, c] of list.entries()) {
      setBusy(`Importing ${c.code || c.name} from Canvas (${i + 1} of ${list.length})...`);
      try {
        const { course } = await canvasCourse({ baseUrl, token: token.trim(), courseId: c.id });
        if (course.weights.length) {
          imported.push(course);
          next[c.id] = "added";
        } else next[c.id] = "skipped";
      } catch {
        next[c.id] = "failed";
      }
      setStatus({ ...next });
    }
    if (imported.length) onImportAll(imported);
    else onError("None of your Canvas courses have graded work yet, so there was nothing to import.");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/80">
        Pull your assignments, due dates and grade weights straight from Canvas. Canvas doesn't know your weekly
        topics, so upload slides afterwards for summaries and quizzes.
      </p>

      <button type="button" onClick={() => setShowHelp((v) => !v)} className="text-sm font-medium text-brand-dark hover:underline">
        {showHelp ? "Hide" : "How do I get a Canvas token?"}
      </button>
      {showHelp && (
        <div className="space-y-2 rounded-lg bg-mist p-3 text-sm text-ink/80">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Log in to Canvas and open <b>Account</b>, then <b>Settings</b>.</li>
            <li>Scroll to <b>Approved Integrations</b> and click <b>+ New Access Token</b>.</li>
            <li>Purpose: "LockedIn". Pick an expiry date, then click <b>Generate Token</b>.</li>
            <li>Copy the token and paste it below. Canvas only shows it once.</li>
          </ol>
          {CANVAS_TUTORIAL_URL ? (
            <a href={CANVAS_TUTORIAL_URL} target="_blank" rel="noreferrer" className="inline-block font-medium text-brand-dark hover:underline">
              Watch the 1-minute video
            </a>
          ) : (
            <p className="text-ink/50">Video walkthrough coming soon.</p>
          )}
          <p className="text-ink/50">
            We only use the token to read your courses. It isn't saved anywhere. You can delete it in Canvas any time.
          </p>
        </div>
      )}

      <form onSubmit={loadCourses} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-ink/80">Canvas address</span>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={!!busy}
            className="w-full rounded-lg bg-mist px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-ink/80">Access token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={!!busy}
            placeholder="Paste your token"
            autoComplete="off"
            className="w-full rounded-lg bg-mist px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <button
          type="submit"
          disabled={!!busy || token.trim().length < 10}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
        >
          Connect and import my courses
        </button>
      </form>

      {courses?.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink/80">Your Canvas courses</div>
          <ul className="space-y-2">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-mist px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{c.code || c.name}</div>
                  {c.code && c.code !== c.name && <div className="truncate text-xs text-ink/60">{c.name}</div>}
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    status[c.id] === "added" ? "text-brand-dark" : status[c.id] === "failed" ? "text-danger-dark" : "text-ink/50"
                  }`}
                >
                  {{ added: "Added", skipped: "No graded work, skipped", failed: "Couldn't import" }[status[c.id]] ?? "Waiting..."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
