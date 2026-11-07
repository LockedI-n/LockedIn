// Shared Gemini helper and the sidekick personality prompt.
// Files starting with "_" are not turned into routes by Vercel.
// Owner: Person 2 (AI and Backend).

import { GoogleGenAI } from "@google/genai";

// Keep in sync with SIDEKICK_NAME in src/lib/config.js
export const SIDEKICK_NAME = "Sparky";

// Models to try, in order. If one is busy (503/429), we move to the next one.
// gemini-3.8-flash was taking 2-3 minutes per call, so it is not first.
// gemini-2.5-flash does not work for new API keys.
export const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

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
