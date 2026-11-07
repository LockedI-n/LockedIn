// localStorage helpers. All app data lives here (no database).
// Owner: Person 3 (Dashboard, Sidekick, Progress).

import { STORAGE_KEY } from "./config.js";

// Shape: { courses: [], habits: [], streaks: {} }
export const DEFAULT_STATE = { courses: [], habits: [], streaks: {} };

// Load saved state. Returns the default state if nothing is saved or the data is broken.
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const saved = JSON.parse(raw);
    // Fill in any missing keys so old saves still work.
    return { ...structuredClone(DEFAULT_STATE), ...saved };
  } catch (err) {
    console.warn("Could not load state, using default.", err);
    return structuredClone(DEFAULT_STATE);
  }
}

// Save the whole state object.
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Could not save state.", err);
  }
}

// Wipe everything (handy for demos).
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Could not clear state.", err);
  }
}
