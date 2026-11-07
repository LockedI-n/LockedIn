// POST /api/slides
// Input:  { courseName, text?, images?: [{ data, mimeType }] }   (data is base64, no "data:" prefix)
// Output: { topics: [{ name, summary }] }
// Owner: Person 2 (AI and Backend).

import { askJSON, hasKey, readBody } from "./_gemini.js";
import { sampleSlides } from "./_samples.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseName = "", text = "", images = [] } = readBody(req);

  if (!hasKey) {
    return res.status(200).json({ ...sampleSlides, fallback: true });
  }

  const prompt = `These are lecture slides for the course "${courseName}".
Group the content by topic and write a short study summary for each topic.

Rules:
- Each summary is 2 to 4 plain sentences a student can review in one minute.
- Only use what is in the slides. Do not add outside facts.

Return ONLY JSON in exactly this shape:
{ "topics": [{ "name": "Decision Trees", "summary": "..." }] }

${text ? `Slide text:\n${text}` : "The slides are attached as images."}`;

  const parts = images.map((img) => ({
    inlineData: { data: img.data, mimeType: img.mimeType || "image/png" },
  }));

  try {
    const data = await askJSON(prompt, parts);
    return res.status(200).json({ topics: Array.isArray(data.topics) ? data.topics : [] });
  } catch (err) {
    console.error("slides error:", err);
    return res.status(200).json({ ...sampleSlides, fallback: true });
  }
}
