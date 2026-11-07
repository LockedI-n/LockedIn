// Add course: build a course from any mix of Canvas, PDFs, screenshots and manual entry.
// Owner: Person 1 (Uploads and Content).
//
// Every option fills in part of the same course and saves it right away
// (with Sunny's upsertCourse), so the Dashboard and Test pages can use it.

import { useState } from "react";
import Sidekick from "../components/Sidekick.jsx";
import CanvasPanel from "../components/addcourse/CanvasPanel.jsx";
import FilePanel from "../components/addcourse/FilePanel.jsx";
import CourseEditor from "../components/addcourse/CourseEditor.jsx";
import { loadState } from "../lib/storage.js";
import { courseIdFor, emptyCourse, mergeSummaries, mergeTopics, mergeWeights, saveCourse, totalPercent } from "../lib/courses.js";

const OPTIONS = [
  { id: "canvas", title: "Connect Canvas", hint: "Deadlines and grade weights, automatically" },
  { id: "pdf", title: "Upload PDFs", hint: "Syllabus and lecture slides" },
  { id: "screenshot", title: "Screenshot", hint: "A photo of the grading table or a slide" },
  { id: "manual", title: "Enter by hand", hint: "Add a missing date, item or topic" },
];

// What Sparky says after each step.
function sparkyFor(course, event) {
  if (!course) return { mood: "happy", message: "Let's add a course! Type its name, then pick any option below. You can mix them." };
  const missingDates = course.weights.filter((w) => !w.date).length;
  const total = totalPercent(course);
  const withSummary = course.topics.filter((t) => t.summary).length;
  const biggest = [...course.weights].sort((a, b) => b.percent - a.percent)[0];

  switch (event?.type) {
    case "canvas":
      return {
        mood: "proud",
        message: `Pulled ${event.count} deadlines from Canvas!${biggest ? ` ${biggest.item} is worth ${biggest.percent}%, so we'll start on it early.` : ""} Upload slides next so I can quiz you.`,
      };
    case "syllabus":
      return { mood: "proud", message: `Found ${course.weights.length} graded items and ${course.topics.length} topics. Nice!` };
    case "slides":
      return {
        mood: "happy",
        message: `Summaries ready for ${event.count} topic${event.count === 1 ? "" : "s"}. ${withSummary} of ${course.topics.length} topics are ready for quizzes!`,
      };
    case "error":
      return { mood: "nudge", message: event.message };
    default:
      break;
  }
  if (course.weights.length && Math.abs(total - 100) > 1)
    return { mood: "nudge", message: `Your grades add up to ${total}%. Is something missing, like a midterm or final? Add it by hand.` };
  if (missingDates)
    return { mood: "nudge", message: `${missingDates} item${missingDates === 1 ? " has" : "s have"} no due date. Add ${missingDates === 1 ? "it" : "them"} so I can remind you!` };
  if (course.topics.length && withSummary < course.topics.length)
    return { mood: "thinking", message: `Upload slides for the rest of your topics and I'll write the summaries.` };
  if (course.weights.length || course.topics.length) return { mood: "proud", message: `${course.name} is all set! Check your Dashboard for today's habit.` };
  return { mood: "happy", message: `Great, ${course.name}! Pick any option below to fill it in.` };
}

// Props: initialCourseId (open an existing course, e.g. from the Dashboard's "Add slides"),
//        onNavigate(page) to move to another page.
export default function Upload({ initialCourseId, onNavigate = () => {} }) {
  const [courses, setCourses] = useState(() => loadState().courses);
  const [courseName, setCourseName] = useState(() => courses.find((c) => c.id === initialCourseId)?.name ?? "");
  const [open, setOpen] = useState(initialCourseId ? "pdf" : null);
  const [busy, setBusy] = useState("");
  const [event, setEvent] = useState(null);
  const [sampleWarning, setSampleWarning] = useState(false);

  const name = courseName.trim();
  const saved = courses.find((c) => c.id === courseIdFor(name));
  const course = name ? (saved ?? emptyCourse(name)) : null;
  const sparky = busy ? { mood: "thinking", message: busy } : sparkyFor(course, event);

  // Save a new version of the course and remember why (for Sparky).
  function update(next, why) {
    setCourses(saveCourse(next));
    setEvent(why);
  }
  const onError = (message) => setEvent({ type: "error", message });

  function onCanvasImport(imported) {
    const targetName = name || imported.name;
    if (!name) setCourseName(targetName);
    const base = courses.find((c) => c.id === courseIdFor(targetName)) ?? emptyCourse(targetName);
    update({ ...base, weights: mergeWeights(base.weights, imported.weights) }, { type: "canvas", count: imported.weights.length });
  }

  function onFileResult(kind, result) {
    setSampleWarning(Boolean(result.fallback));
    if (kind === "syllabus") {
      update(
        { ...course, weights: mergeWeights(course.weights, result.weights), topics: mergeTopics(course.topics, result.topics) },
        { type: "syllabus" }
      );
    } else {
      const topics = result.topics ?? [];
      update({ ...course, topics: mergeSummaries(course.topics, topics) }, { type: "slides", count: topics.length });
    }
  }

  return (
    <section className="space-y-6">
      <Sidekick mood={sparky.mood} message={sparky.message} />

      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Add a course</h2>
        <p className="text-slate-400">Use one option or combine them. Everything saves as you go.</p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-300">Course name</span>
        <input
          list="saved-courses"
          value={courseName}
          onChange={(e) => {
            setCourseName(e.target.value);
            setEvent(null);
          }}
          placeholder="e.g. CMPT 455 (or connect Canvas to fill this in)"
          disabled={!!busy}
          className="w-full rounded-xl bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <datalist id="saved-courses">
          {courses.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {OPTIONS.map((o) => {
          const needsName = o.id !== "canvas" && !name;
          const active = open === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={needsName}
              onClick={() => setOpen(active ? null : o.id)}
              title={needsName ? "Type a course name first" : undefined}
              className={`rounded-2xl p-4 text-left transition ${
                active ? "bg-amber-400 text-slate-950" : "bg-slate-900 ring-1 ring-slate-800 hover:ring-amber-400"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <div className="font-semibold">{o.title}</div>
              <div className={`mt-1 text-xs ${active ? "text-slate-800" : "text-slate-400"}`}>{o.hint}</div>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
          {open === "canvas" && <CanvasPanel busy={busy} setBusy={setBusy} onImport={onCanvasImport} onError={onError} />}
          {(open === "pdf" || open === "screenshot") && course && (
            <FilePanel mode={open} course={course} busy={busy} setBusy={setBusy} onResult={onFileResult} onError={onError} />
          )}
          {open === "manual" && (
            <p className="text-sm text-slate-300">Add or fix anything in the course below. Dates you add here are used for reminders.</p>
          )}
        </div>
      )}

      {sampleWarning && (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
          The AI was busy, so that last result is sample data. Try the upload again in a minute.
        </p>
      )}

      {course && (saved || open === "manual") && <CourseEditor course={course} onChange={update} manualOpen={open === "manual"} />}

      {saved && (saved.weights.length > 0 || saved.topics.length > 0) && (
        <button
          type="button"
          onClick={() => onNavigate("Dashboard")}
          className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-300"
        >
          Done, go to my Dashboard
        </button>
      )}
    </section>
  );
}
