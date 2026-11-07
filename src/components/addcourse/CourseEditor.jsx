// Shows the course being built and lets the student fix or add anything by hand
// (e.g. a midterm date Canvas didn't have). This is the "enter manually" option.
// Owner: Person 1 (Uploads and Content).

import { useState } from "react";
import { totalPercent } from "../../lib/courses.js";
import { topicShare } from "../../lib/mastery.js";

const input = "rounded-md bg-mist px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand";

export default function CourseEditor({ course, onChange, manualOpen }) {
  const [item, setItem] = useState("");
  const [percent, setPercent] = useState("");
  const [date, setDate] = useState("");
  const [topic, setTopic] = useState("");

  const total = totalPercent(course);
  const weights = [...course.weights].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  const setWeight = (name, patch) =>
    onChange({ ...course, weights: course.weights.map((w) => (w.item === name ? { ...w, ...patch } : w)) }, "edit");
  const removeWeight = (name) => onChange({ ...course, weights: course.weights.filter((w) => w.item !== name) }, "edit");
  const removeTopic = (name) => onChange({ ...course, topics: course.topics.filter((t) => t.name !== name) }, "edit");

  function addWeight(e) {
    e.preventDefault();
    if (!item.trim()) return;
    onChange(
      { ...course, weights: [...course.weights.filter((w) => w.item !== item.trim()), { item: item.trim(), percent: Number(percent) || 0, date: date || null }] },
      "manual"
    );
    setItem("");
    setPercent("");
    setDate("");
  }

  function addTopic(e) {
    e.preventDefault();
    if (!topic.trim() || course.topics.some((t) => t.name.toLowerCase() === topic.trim().toLowerCase())) return;
    onChange({ ...course, topics: [...course.topics, { name: topic.trim(), week: null, summary: "", score: null }] }, "manual");
    setTopic("");
  }

  return (
    <div className="space-y-5 rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{course.name}</h3>
        {course.weights.length > 0 && (
          <span className={`text-sm font-medium ${Math.abs(total - 100) <= 1 ? "text-brand-dark" : "text-danger-dark"}`}>
            Grades add up to {total}%
          </span>
        )}
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/60">Grading and deadlines</h4>
        {weights.length === 0 && <p className="text-sm text-ink/50">Nothing yet. Use any option above, or add items by hand.</p>}
        <ul className="divide-y divide-line">
          {weights.map((w) => (
            <li key={w.item} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1 text-sm">
                {w.item}
                {w.group && w.group !== w.item && <span className="ml-1 text-xs text-ink/50">({w.group})</span>}
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={w.percent}
                onChange={(e) => setWeight(w.item, { percent: Number(e.target.value) || 0 })}
                aria-label={`${w.item} percent`}
                className={`${input} w-20 text-right`}
              />
              <span className="text-sm text-ink/50">%</span>
              <input
                type="date"
                value={w.date || ""}
                onChange={(e) => setWeight(w.item, { date: e.target.value || null })}
                aria-label={`${w.item} due date`}
                className={`${input} ${w.date ? "" : "ring-1 ring-coral"}`}
              />
              <button type="button" onClick={() => removeWeight(w.item)} aria-label={`Remove ${w.item}`} className="px-1 text-ink/50 hover:text-danger-dark">
                ✕
              </button>
            </li>
          ))}
        </ul>
        {manualOpen && (
          <form onSubmit={addWeight} className="flex flex-wrap items-center gap-2 rounded-lg bg-mist p-2">
            <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Midterm" aria-label="Item name" className={`${input} min-w-0 flex-1`} />
            <input type="number" min="0" max="100" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="%" aria-label="Percent" className={`${input} w-20`} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Due date" className={input} />
            <button type="submit" className="rounded-md bg-brand px-3 py-1 text-sm font-semibold text-white hover:bg-brand-dark">
              Add item
            </button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/60">Topics</h4>
        {course.topics.length === 0 && <p className="text-sm text-ink/50">No topics yet. Upload a syllabus or slides.</p>}
        <ul className="flex flex-wrap gap-2">
          {course.topics.map((t) => (
            <li
              key={t.name}
              title={t.summary || "No summary yet. Upload slides for this topic."}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${t.summary ? "bg-brand/15 text-brand-dark" : "bg-mist text-ink/80"}`}
            >
              {t.week != null && <span className="text-xs opacity-60">W{t.week}</span>}
              {t.name}
              {course.weights.length > 0 && topicShare(course, t.name) > 0 && (
                <span className="text-xs opacity-60">{topicShare(course, t.name)}%</span>
              )}
              <button type="button" onClick={() => removeTopic(t.name)} aria-label={`Remove ${t.name}`} className="opacity-50 hover:text-danger-dark hover:opacity-100">
                ✕
              </button>
            </li>
          ))}
        </ul>
        {course.topics.length > 0 && (
          <p className="text-xs text-ink/50">
            Green topics have a summary, so they're ready for quizzes. The % is how much of your grade depends on that topic.
          </p>
        )}
        {manualOpen && (
          <form onSubmit={addTopic} className="flex gap-2">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Decision Trees" aria-label="Topic name" className={`${input} min-w-0 flex-1`} />
            <button type="submit" className="rounded-md bg-brand px-3 py-1 text-sm font-semibold text-white hover:bg-brand-dark">
              Add topic
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
