// Add course: build a course from any mix of Canvas, PDFs, screenshots and manual entry.
// Owner: Person 1 (Uploads and Content).
//
// Every option fills in part of the same course and saves it right away
// (with Sunny's upsertCourse), so the Dashboard and Test pages can use it.

import { useRef, useState } from "react";
import Sidekick from "../components/Sidekick.jsx";
import CanvasPanel from "../components/addcourse/CanvasPanel.jsx";
import FilePanel from "../components/addcourse/FilePanel.jsx";
import CourseEditor from "../components/addcourse/CourseEditor.jsx";
import { loadState, updateState, removeCourse } from "../lib/storage.js";
import { courseIdFor, emptyCourse, mergeSummaries, mergeTopics, mergeWeights, saveCourse, totalPercent } from "../lib/courses.js";

const OPTIONS = [
  { id: "canvas", title: "Connect Canvas", hint: "Deadlines and grade weights, automatically" },
  { id: "pdf", title: "Upload files", hint: "PDF or PowerPoint, several at once" },
  { id: "screenshot", title: "Screenshot", hint: "A photo of the grading table or a slide" },
  { id: "manual", title: "Enter by hand", hint: "Add a missing date, item or topic" },
];

// What Jepi says after each step.
function sparkyFor(course, event) {
  if (!course && event?.type === "canvas")
    return { mood: "proud", message: `Boom, ${event.count} courses pulled from Canvas! Tap one below to check it, then add slides so I can quiz you.` };
  if (!course && event?.type === "deleted") return { mood: "happy", message: `${event.name} is gone. One less thing on your plate!` };
  if (!course) return { mood: "happy", message: "Let's add a course! Type its name, or connect Canvas and I'll grab them all." };
  const missingDates = course.weights.filter((w) => !w.date).length;
  const total = totalPercent(course);
  const withSummary = course.topics.filter((t) => t.summary).length;
  const biggest = [...course.weights].sort((a, b) => b.percent - a.percent)[0];

  switch (event?.type) {
    case "canvas":
      return event.count === 1
        ? {
            mood: "proud",
            message: `Got ${course.name} from Canvas!${biggest ? ` ${biggest.item} is worth ${biggest.percent}%, so we start on it early.` : ""} Drop in your slides next so I can quiz you.`,
          }
        : { mood: "proud", message: `Boom, ${event.count} courses pulled from Canvas! Tap one below to check it, then add slides so I can quiz you.` };
    case "deleted":
      return { mood: "happy", message: `${event.name} is gone. One less thing on your plate!` };
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
  if (course.weights.length && total > 101)
    return { mood: "nudge", message: `Your grades add up to ${total}%. Something might be counted twice. Remove the extra item below.` };
  if (course.weights.length && total < 99)
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
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef(null);

  const name = courseName.trim();
  const saved = courses.find((c) => c.id === courseIdFor(name));
  const course = name ? (saved ?? emptyCourse(name)) : null;
  const sparky = busy
    ? { mood: "thinking", message: busy }
    : needName && !name
      ? { mood: "nudge", message: "First, type your course name in the box (like CMPT 455). Then pick how to add it!" }
      : sparkyFor(course, event);

  function pickOption(id) {
    if (id !== "canvas" && !name) {
      setNeedName(true);
      setOpen(id);
      nameRef.current?.focus();
      return;
    }
    // Only close it if its panel was actually showing (it's hidden while the name is missing).
    const showing = open === id && (id === "canvas" || name);
    setOpen(showing ? null : id);
  }

  // Save a new version of the course and remember why (for Jepi).
  function update(next, why) {
    setCourses(saveCourse(next));
    setEvent(why);
  }
  const onError = (message) => setEvent({ type: "error", message });

  // The latest saved version of a course (several files can finish one after another).
  const latest = (courseName) => loadState().courses.find((c) => c.id === courseIdFor(courseName)) ?? emptyCourse(courseName);

  // Canvas: every course is saved as its own course, named the way Canvas names it.
  function onCanvasImportAll(list) {
    let saved = courses;
    for (const imported of list) {
      const base = latest(imported.name);
      saved = saveCourse({ ...base, weights: mergeWeights(base.weights, imported.weights) });
    }
    setCourses(saved);
    if (list.length === 1) setCourseName(list[0].name);
    setEvent({ type: "canvas", count: list.length, names: list.map((c) => c.name) });
  }

  function onFileResult(kind, result) {
    setSampleWarning(Boolean(result.fallback));
    const base = latest(name);
    if (kind === "syllabus") {
      update(
        { ...base, weights: mergeWeights(base.weights, result.weights), topics: mergeTopics(base.topics, result.topics) },
        { type: "syllabus" }
      );
    } else {
      const topics = result.topics ?? [];
      update({ ...base, topics: mergeSummaries(base.topics, topics) }, { type: "slides", count: topics.length });
    }
  }

  function deleteCourse(c) {
    if (!window.confirm(`Delete ${c.name}? Its topics, scores and habits will be removed.`)) return;
    setCourses(updateState((s) => removeCourse(s, c.id)).courses);
    setCourseName("");
    setOpen(null);
    setEvent({ type: "deleted", name: c.name });
  }

  return (
    <section className="space-y-6">
      <Sidekick mood={sparky.mood} message={sparky.message} />

      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Add a course</h2>
        <p className="text-ink/60">Use one option or combine them. Everything saves as you go.</p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink/80">1. Course name</span>
        <input
          ref={nameRef}
          list="saved-courses"
          value={courseName}
          onChange={(e) => {
            setCourseName(e.target.value);
            setEvent(null);
          }}
          placeholder="e.g. CMPT 455 (or connect Canvas to fill this in)"
          disabled={!!busy}
          className={`w-full rounded-xl bg-white px-4 py-3 text-ink placeholder-ink/40 outline-none ring-1 focus:ring-2 focus:ring-brand ${
            needName && !name ? "ring-2 ring-coral" : "ring-line"
          }`}
        />
        <datalist id="saved-courses">
          {courses.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>

      {courses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink/50">Your courses:</span>
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCourseName(c.name);
                setEvent(null);
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                saved?.id === c.id ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line hover:ring-brand"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
      <span className="text-sm font-medium text-ink/80">2. How do you want to add it? Pick one or more</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {OPTIONS.map((o) => {
          const active = open === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pickOption(o.id)}
              className={`rounded-2xl p-4 text-left transition ${
                active ? "bg-brand text-white" : "bg-white ring-1 ring-line hover:ring-brand"
              }`}
            >
              <div className="font-semibold">{o.title}</div>
              <div className={`mt-1 text-xs ${active ? "text-white/85" : "text-ink/60"}`}>{o.hint}</div>
            </button>
          );
        })}
      </div>
      </div>

      {open && !(open !== "canvas" && !name) && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          {open === "canvas" && <CanvasPanel busy={busy} setBusy={setBusy} onImportAll={onCanvasImportAll} onError={onError} />}
          {(open === "pdf" || open === "screenshot") && course && (
            <FilePanel mode={open} courseName={name} getTopics={() => latest(name).topics.map((t) => t.name)} busy={busy} setBusy={setBusy} onResult={onFileResult} onError={onError} />
          )}
          {open === "manual" && (
            <p className="text-sm text-ink/80">Add or fix anything in the course below. Dates you add here are used for reminders.</p>
          )}
        </div>
      )}

      {sampleWarning && (
        <p className="rounded-lg bg-coral/20 px-3 py-2 text-sm text-danger-dark">
          The AI was busy, so that last result is sample data. Try the upload again in a minute.
        </p>
      )}

      {course && (saved || open === "manual") && <CourseEditor course={course} onChange={update} manualOpen={open === "manual"} onDelete={saved ? () => deleteCourse(saved) : null} />}

      {saved && (saved.weights.length > 0 || saved.topics.length > 0) && (
        <button
          type="button"
          onClick={() => onNavigate("Dashboard")}
          className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark"
        >
          Done, go to my Dashboard
        </button>
      )}
    </section>
  );
}
