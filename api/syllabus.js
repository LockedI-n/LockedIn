// POST /api/syllabus
// Input:  { courseName, text?, fileBase64?, mimeType? }   (file can be a PDF or a screenshot: image/png, image/jpeg, image/webp)
// Output: { weights: [{ item, percent, date }], topics: [{ name, week, summary, score }] }
// Owner: Person 2 (AI and Backend).

import { askJSON, hasKey, readBody } from "./_gemini.js";
import { sampleSyllabus } from "./_samples.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseName = "", text = "", fileBase64, mimeType } = readBody(req);

  if (!hasKey) {
    return res.status(200).json({ ...sampleSyllabus, fallback: true });
  }

  const prompt = `Read the syllabus for the course "${courseName}".
Extract the grading breakdown and the list of topics.

Rules:
- Only include items that are actually in the syllabus. Never invent anything.
- If a date is not given, use null. Dates must be "YYYY-MM-DD".
- percent is a number (no % sign).
- week is a number, or null if not given.
- summary is always "" and score is always null (filled in later).

Return ONLY JSON in exactly this shape:
{
  "weights": [{ "item": "Final", "percent": 40, "date": "2026-12-10" }],
  "topics": [{ "name": "Decision Trees", "week": 5, "summary": "", "score": null }]
}

${text ? `Syllabus text:\n${text}` : "The syllabus is attached as a file or image. It may be a screenshot of only part of it (for example just the grading table, or a Canvas page). Extract whatever is visible and return empty lists for anything not shown."}`;

  const parts = fileBase64 ? [{ inlineData: { data: fileBase64, mimeType: mimeType || "application/pdf" } }] : [];

  try {
    const data = await askJSON(prompt, parts);
    return res.status(200).json({
      weights: Array.isArray(data.weights) ? data.weights : [],
      topics: Array.isArray(data.topics) ? data.topics : [],
    });
  } catch (err) {
    console.error("syllabus error:", err);
    return res.status(200).json({ ...sampleSyllabus, fallback: true });
  }
}
