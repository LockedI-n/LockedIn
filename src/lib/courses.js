// Helpers for building one course from several sources (Canvas, PDF, screenshot, manual).
// Each source only fills in what it knows, so they can be combined in any order.
// Owner: Person 1 (Uploads and Content).

import { loadState, updateState, upsertCourse } from "./storage.js";

// "CMPT 455" -> "cmpt455"
export const courseIdFor = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, "") || "course";

const key = (s) => String(s ?? "").trim().toLowerCase();

// Grading items from different sources name things differently:
// "Midterm (1.5 hours)", "Midterm", "Final Exam", "final" should all match.
const itemKey = (s) =>
  key(s)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(exam|examination|test)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");

export function findCourse(name) {
  const id = courseIdFor(name);
  return loadState().courses.find((c) => c.id === id) ?? null;
}

export function emptyCourse(name) {
  return { id: courseIdFor(name), name: name.trim(), weights: [], topics: [] };
}

// Combine grading items by name. New values win, but a missing date/percent never erases a known one.
export function mergeWeights(oldWeights = [], incoming = []) {
  const merged = oldWeights.map((w) => ({ ...w }));
  for (const w of incoming) {
    if (!w || !String(w.item ?? "").trim()) continue;
    const match = merged.find((m) => itemKey(m.item) === itemKey(w.item));
    if (match) {
      if (typeof w.percent === "number") match.percent = w.percent;
      if (w.date) match.date = w.date;
      if (w.group) match.group = w.group;
      if (Array.isArray(w.covers)) match.covers = w.covers;
    } else {
      merged.push({
        item: String(w.item).trim(),
        percent: Number(w.percent) || 0,
        date: w.date || null,
        ...(w.group ? { group: w.group } : {}),
        ...(Array.isArray(w.covers) ? { covers: w.covers } : {}),
      });
    }
  }
  return foldGroupTotals(merged);
}

// Some sources give a total ("Project 40%"), others give its parts
// ("Project proposal 10%", "Report 20%", ... all in group "Course project").
// When a total's name matches a group and the group's parts add up to it,
// keep the parts and drop the total, so nothing is counted twice.
export function foldGroupTotals(weights = []) {
  const near = (a, b) => Math.abs(a - b) <= 1;
  return weights.filter((total) => {
    const k = itemKey(total.item);
    if (!k) return true;
    const parts = weights.filter(
      (w) => w !== total && w.group && (itemKey(w.group).includes(k) || k.includes(itemKey(w.group)))
    );
    const sum = parts.reduce((s, w) => s + (Number(w.percent) || 0), 0);
    return !(parts.length >= 2 && near(sum, Number(total.percent) || 0));
  });
}

// Combine topic lists by name. Keeps summaries and scores already saved.
export function mergeTopics(oldTopics = [], incoming = []) {
  const merged = oldTopics.map((t) => ({ ...t }));
  for (const t of incoming) {
    if (!t || !String(t.name ?? "").trim()) continue;
    const match = merged.find((m) => key(m.name) === key(t.name));
    if (match) {
      if (t.week != null) match.week = t.week;
      if (t.summary && !match.summary) match.summary = t.summary;
    } else {
      merged.push({ name: String(t.name).trim(), week: t.week ?? null, summary: t.summary || "", score: null });
    }
  }
  return merged;
}

// Put slide summaries onto topics (appends if a topic already has one).
export function mergeSummaries(oldTopics = [], slideTopics = []) {
  const merged = oldTopics.map((t) => ({ ...t }));
  for (const st of slideTopics) {
    const match = merged.find((t) => key(t.name) === key(st.name));
    if (match) match.summary = match.summary && match.summary !== st.summary ? `${match.summary} ${st.summary}` : st.summary;
    else merged.push({ name: st.name, week: null, summary: st.summary, score: null });
  }
  return merged;
}

// Save (add or replace) a course. Returns the saved list of courses.
export function saveCourse(course) {
  return updateState((s) => upsertCourse(s, course)).courses;
}

// Total of all grading percents, e.g. 100.
export const totalPercent = (course) =>
  Math.round((course?.weights ?? []).reduce((sum, w) => sum + (Number(w.percent) || 0), 0) * 10) / 10;

// File -> base64 string without the "data:...;base64," prefix.
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

// Shrink a big screenshot (phone photos can be 5+ MB) so it fits the upload limit.
export async function shrinkImage(file, maxSide = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not open that image."));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
