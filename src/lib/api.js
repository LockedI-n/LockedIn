// Frontend functions that call our /api endpoints.
// The Gemini key lives on the server only. Never put it in this file.
// Owner: Person 2 (AI and Backend). Person 1 and 4 call these.
//
// Every response may include `fallback: true`, which means sample data was
// returned (no API key set, or Gemini failed). The UI can still work with it.

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed with status ${res.status}`);
  }
  return res.json();
}

// { courseName, text?, fileBase64?, mimeType? } -> { weights, topics }
export function parseSyllabus({ courseName, text, fileBase64, mimeType }) {
  return post("/api/syllabus", { courseName, text, fileBase64, mimeType });
}

// { courseName, text?, images?: [{ data, mimeType }], topics?: [string] } -> { topics: [{ name, summary }] }
// Pass `topics` (the course's topic names) so summaries come back under those exact names.
export function summarizeSlides({ courseName, text, images, topics }) {
  return post("/api/slides", { courseName, text, images, topics });
}

// { courseName, topic, summary, count?, difficulty?: "easy" | "medium" | "hard" } -> { quiz: [...] }
export function getQuiz({ courseName, topic, summary, count = 4, difficulty = "medium" }) {
  return post("/api/quiz", { courseName, topic, summary, count, difficulty });
}

// { courseName, topic, summary, mode: "feynman" | "written", answer }
//   -> { score, gotRight, missed, sidekickMessage }
export function gradeAnswer({ courseName, topic, summary, mode, answer }) {
  return post("/api/grade", { courseName, topic, summary, mode, answer });
}

// Canvas LMS (through our server, the token is never stored).
// { baseUrl, token } -> { courses: [{ id, name, code }] }
export function canvasCourses({ baseUrl, token }) {
  return postCanvas({ baseUrl, token, action: "courses" });
}

// { baseUrl, token, courseId } -> { course: { name, weights: [{ item, percent, date, group }] } }
export function canvasCourse({ baseUrl, token, courseId }) {
  return postCanvas({ baseUrl, token, action: "course", courseId });
}

// Like post(), but shows Canvas's own error message (wrong token, etc.).
async function postCanvas(body) {
  const res = await fetch("/api/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Canvas request failed (${res.status})`);
  return data;
}
