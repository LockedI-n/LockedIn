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

// { courseName, text?, images?: [{ data, mimeType }] } -> { topics: [{ name, summary }] }
export function summarizeSlides({ courseName, text, images }) {
  return post("/api/slides", { courseName, text, images });
}

// { courseName, topic, summary, count? } -> { quiz: [...] }
export function getQuiz({ courseName, topic, summary, count = 4 }) {
  return post("/api/quiz", { courseName, topic, summary, count });
}

// { courseName, topic, summary, mode: "feynman" | "written", answer }
//   -> { score, gotRight, missed, sidekickMessage }
export function gradeAnswer({ courseName, topic, summary, mode, answer }) {
  return post("/api/grade", { courseName, topic, summary, mode, answer });
}
