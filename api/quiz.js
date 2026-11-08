// POST /api/quiz
// Input:  { courseName, topic, summary, count = 4 (1-15), difficulty = "medium" ("easy" | "medium" | "hard") }
// Output: { quiz: [{ question, options: [4 strings], answer: index, explanation }] }
// Owner: Person 2 (AI and Backend).

import { askJSON, hasKey, readBody, SIDEKICK_NAME } from "./_gemini.js";
import { sampleQuiz } from "./_samples.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);
  const { courseName = "", topic = "", summary = "" } = body;
  const count = Math.max(1, Math.min(15, Math.round(Number(body.count) || 4)));
  const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
  const LEVEL = {
    easy: "Easy: check key definitions and basic facts. One clearly correct answer, obviously wrong distractors.",
    medium: "Medium: test understanding, not memorising. Plausible distractors based on common mix-ups.",
    hard: "Hard: exam level. Apply the idea to a new example, compare concepts, or reason about edge cases. Tricky but fair distractors.",
  };

  if (!hasKey) {
    return res.status(200).json({ ...sampleQuiz, fallback: true });
  }

  const prompt = `Write ${count} multiple choice questions to test a student on the topic "${topic}" from the course "${courseName}".

Base the questions on this summary:
${summary || "(no summary given, use standard university-level content for this topic)"}

Difficulty: ${LEVEL[difficulty]}

Rules:
- Write exactly ${count} questions.
- Each question has exactly 4 options.
- "answer" is the index (0 to 3) of the correct option.
- Only one option is correct. Mix up where the correct answer is.
- "explanation" is one short sentence where you (${SIDEKICK_NAME}) explain why the answer is right, talking to the student.

Return ONLY JSON in exactly this shape:
{ "quiz": [{ "question": "...", "options": ["", "", "", ""], "answer": 0, "explanation": "..." }] }`;

  try {
    const data = await askJSON(prompt);
    // Keep only well-formed questions.
    const quiz = (Array.isArray(data.quiz) ? data.quiz : []).filter(
      (q) => q && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
    ).slice(0, count);
    if (quiz.length === 0) throw new Error("No valid questions returned");
    return res.status(200).json({ quiz });
  } catch (err) {
    console.error("quiz error:", err);
    return res.status(200).json({ ...sampleQuiz, fallback: true });
  }
}
