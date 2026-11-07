// POST /api/grade
// Input:  { courseName, topic, summary, mode: "feynman" | "written", answer }
// Output: { score: 0-100, gotRight: [string], missed: [string], sidekickMessage: string }
// Owner: Person 2 (AI and Backend).

import { askJSON, hasKey, readBody, SIDEKICK_NAME } from "./_gemini.js";
import { sampleGrade } from "./_samples.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseName = "", topic = "", summary = "", mode = "written", answer = "" } = readBody(req);

  if (!hasKey) {
    return res.status(200).json({ ...sampleGrade, fallback: true });
  }

  // Feynman mode: the student teaches the sidekick. Written mode: normal grading.
  const roleText =
    mode === "feynman"
      ? `The student is teaching YOU (${SIDEKICK_NAME}) the topic, using the Feynman method.
Act like a curious friend who is learning it for the first time.
Judge how clearly and correctly they explained it, as if you had to understand it from their words alone.
In "sidekickMessage", react in your own voice: say what you now understand, and ask about the part that still confuses you. Be honest if the explanation was weak.`
      : `The student wrote an answer explaining the topic. Grade it like a fair TA.
In "sidekickMessage", give short, honest, encouraging feedback in your own voice.`;

  const prompt = `${roleText}

Course: "${courseName}"
Topic: "${topic}"
Reference summary (what a good answer should cover):
${summary || "(no summary given, use standard university-level content for this topic)"}

Student's answer:
"""
${answer}
"""

Rules:
- score is a whole number from 0 to 100.
- gotRight lists the specific things they explained correctly.
- missed lists key ideas that were wrong or missing.
- If the answer is empty or off-topic, give a low score.

Return ONLY JSON in exactly this shape:
{ "score": 72, "gotRight": ["..."], "missed": ["..."], "sidekickMessage": "..." }`;

  try {
    const data = await askJSON(prompt);
    const score = Math.max(0, Math.min(100, Math.round(Number(data.score) || 0)));
    return res.status(200).json({
      score,
      gotRight: Array.isArray(data.gotRight) ? data.gotRight : [],
      missed: Array.isArray(data.missed) ? data.missed : [],
      sidekickMessage: String(data.sidekickMessage || ""),
    });
  } catch (err) {
    console.error("grade error:", err);
    return res.status(200).json({ ...sampleGrade, fallback: true });
  }
}
