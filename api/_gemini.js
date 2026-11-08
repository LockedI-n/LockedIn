// Shared Gemini helper and the sidekick personality prompt.
// Files starting with "_" are not turned into routes by Vercel.
// Owner: Person 2 (AI and Backend).

import { GoogleGenAI } from "@google/genai";

// Keep in sync with SIDEKICK_NAME in src/lib/config.js
export const SIDEKICK_NAME = "Jepi";

// Models to try, in order. If one is busy (503/429), we move to the next one.
// gemini-3.8-flash was taking 2-3 minutes per call, so it is not first.
// gemini-2.5-flash does not work for new API keys.
export const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

// True when a key is set. Endpoints use this to decide whether to use sample data.
export const hasKey = Boolean(process.env.GEMINI_API_KEY);

// Only create the client when we have a key.
const ai = hasKey ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// The sidekick's personality. Added to the start of every prompt.
export const SIDEKICK = `You are ${SIDEKICK_NAME}, a small, upbeat robot study buddy for university students.
Voice: you talk TO the student in first person ("I", "you"), like a hype friend in the same class.
Casual and warm, a little playful, never cringe or corporate. Short sentences. At most one emoji, and only sometimes.
You cheer real effort, and you're honest when something is wrong, but you always say what to do next.
You never make up facts about a student's course. If something is unknown, you say so or use null.
Never use em dashes or en dashes. Use commas, periods or "to" instead.`;

// Belt and braces: replace any em dash (U+2014) or en dash (U+2013) the model still writes,
// in every string of the result. A dash between numbers becomes "-" (weeks 1-3); any other
// dash becomes a comma ("Spot on, K-means").
export function noDashes(value) {
  if (typeof value === "string")
    return value.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2").replace(/\s*[\u2013\u2014]\s*/g, ", ").replace(/,\s*([.,!?])/g, "$1");
  if (Array.isArray(value)) return value.map(noDashes);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, noDashes(v)]));
  return value;
}

/**
 * Ask Gemini for a JSON answer.
 * @param {string} prompt  instructions, including the exact JSON shape wanted
 * @param {Array} parts    optional extra parts, e.g. [{ inlineData: { data, mimeType } }]
 * @returns {Promise<any>} parsed JSON
 */
export async function askJSON(prompt, parts = []) {
  if (!ai) throw new Error("GEMINI_API_KEY is not set");

  const request = {
    contents: [{ role: "user", parts: [{ text: `${SIDEKICK}\n\n${prompt}` }, ...parts] }],
    config: { responseMimeType: "application/json" },
  };

  // Gemini sometimes says "high demand" (503) or "too many requests" (429).
  // When that happens, try the next model in MODELS instead of waiting.
  let response;
  for (let i = 0; i < MODELS.length; i++) {
    try {
      response = await ai.models.generateContent({ ...request, model: MODELS[i] });
      break;
    } catch (err) {
      const busy = err?.status === 503 || err?.status === 429;
      if (!busy || i === MODELS.length - 1) throw err;
      console.warn(`${MODELS[i]} is busy, trying ${MODELS[i + 1]}`);
    }
  }

  const text = response.text ?? "";
  // Sometimes models wrap JSON in ``` fences. Strip them just in case.
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return noDashes(JSON.parse(cleaned));
}

// Small helper: Vercel usually parses JSON bodies, but be safe if it arrives as a string.
export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}
