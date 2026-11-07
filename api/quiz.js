// POST /api/quiz
// Input:  { courseName, topic, summary, count = 4 }
// Output: { quiz: [{ question, options: [4 strings], answer: index, explanation }] }
// Owner: Person 2 (AI and Backend).

import { askJSON, hasKey, readBody } from "./_gemini.js";
import { sampleQuiz } from "./_samples.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseName = "", topic = "", summary = "", count = 4 } = readBody(req);

  if (!hasKey) {
    return res.status(200).json({ ...sampleQuiz, fallback: true });
  }

  const prompt = `Write ${count} multiple choice questions to test a student on the topic "${topic}" from the course "${courseName}".

Base the questions on this summary:
${summary || "(no summary given, use standard university-level content for this topic)"}

Rules:
- Each question has exactly 4 options.
- "answer" is the index (0 to 3) of the correct option.
- Only one option is correct. Mix up where the correct answer is.
- "explanation" is one short sentence in a friendly voice.

Return ONLY JSON in exactly this shape:
{ "quiz": [{ "question": "...", "options": ["", "", "", ""], "answer": 0, "explanation": "..." }] }`;

  try {
    const data = await askJSON(prompt);
    // Keep only well-formed questions.
    const quiz = (Array.isArray(data.quiz) ? data.quiz : []).filter(
      (q) => q && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer)
    );
    if (quiz.length === 0) throw new Error("No valid questions returned");
    return res.status(200).json({ quiz });
  } catch (err) {
    console.error("quiz error:", err);
    return res.status(200).json({ ...sampleQuiz, fallback: true });
  }
}
