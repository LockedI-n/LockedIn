// Shared Gemini helper and the sidekick personality prompt.
// Files starting with "_" are not turned into routes by Vercel.
// Owner: Person 2 (AI and Backend).

import { GoogleGenAI } from "@google/genai";

// Keep in sync with SIDEKICK_NAME in src/lib/config.js
export const SIDEKICK_NAME = "Sparky";

// Check Google AI Studio for the latest Flash model name and update this if needed.
export const MODEL = "gemini-3.8-flash";

// True when a key is set. Endpoints use this to decide whether to use sample data.
export const hasKey = Boolean(process.env.GEMINI_API_KEY);

// Only create the client when we have a key.
const ai = hasKey ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// The sidekick's personality. Added to the start of every prompt.
export const SIDEKICK = `You are ${SIDEKICK_NAME}, a friendly, upbeat study sidekick for university students.
You are encouraging but honest. You keep messages short (1 to 3 sentences), casual, and specific.
You never make up facts about a student's course. If something is unknown, you say so or use null.`;

/**
 * Ask Gemini for a JSON answer.
 * @param {string} prompt  instructions, including the exact JSON shape wanted
 * @param {Array} parts    optional extra parts, e.g. [{ inlineData: { data, mimeType } }]
 * @returns {Promise<any>} parsed JSON
 */
export async function askJSON(prompt, parts = []) {
  if (!ai) throw new Error("GEMINI_API_KEY is not set");

  const request = {
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `${SIDEKICK}\n\n${prompt}` }, ...parts] }],
    config: { responseMimeType: "application/json" },
  };

  // Gemini sometimes says "high demand" (503) or "too many requests" (429).
  // Retry a couple of times with a short wait before giving up.
  let response;
  for (let attempt = 1; ; attempt++) {
    try {
      response = await ai.models.generateContent(request);
      break;
    } catch (err) {
      const busy = err?.status === 503 || err?.status === 429;
      if (!busy || attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }

  const text = response.text ?? "";
  // Sometimes models wrap JSON in ``` fences. Strip them just in case.
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
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
