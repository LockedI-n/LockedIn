// POST /api/slides
// Input:  { courseName, text?, images?: [{ data, mimeType }], topics?: [string] }
//         (image data is base64, no "data:" prefix)
//         topics = the course's existing topic names (from /api/syllabus). When given,
//         each summary is filed under one of these exact names so it matches the course.
// Output: { topics: [{ name, summary }] }
// Owner: Person 2 (AI and Backend).

import { askJSON, hasKey, readBody } from "./_gemini.js";
import { sampleSlides } from "./_samples.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { courseName = "", text = "", images = [], topics: known = [] } = readBody(req);
  const knownTopics = (Array.isArray(known) ? known : []).filter((t) => typeof t === "string" && t.trim());

  if (!hasKey) {
    return res.status(200).json({ ...sampleSlides, fallback: true });
  }

  const prompt = `These are lecture slides for the course "${courseName}".
Group the content by topic and write a short study summary for each topic.

Rules:
- Each summary is 2 to 4 plain sentences a student can review in one minute.
- Write summaries as neutral study notes: no greetings, no "you", no sidekick voice.
- Only use what is in the slides. Do not add outside facts.
${
  knownTopics.length
    ? `- The course already has these topics: ${JSON.stringify(knownTopics)}.
  Use the EXACT name of the matching topic from that list for "name". Only cover topics the slides actually teach.
  Merge everything about one topic into a single summary. Use a new name only if the slides clearly cover something not in the list.
`
    : ""
}
Return ONLY JSON in exactly this shape:
{ "topics": [{ "name": "Decision Trees", "summary": "..." }] }

${text ? `Slide text:\n${text}` : "The slides are attached as images."}`;

  const parts = images.map((img) => ({
    inlineData: { data: img.data, mimeType: img.mimeType || "image/png" },
  }));

  try {
    const data = await askJSON(prompt, parts);
    const topics = (Array.isArray(data.topics) ? data.topics : []).filter(
      (t) => t && typeof t.name === "string" && typeof t.summary === "string"
    );
    return res.status(200).json({ topics });
  } catch (err) {
    console.error("slides error:", err);
    return res.status(200).json({ ...sampleSlides, fallback: true });
  }
}
