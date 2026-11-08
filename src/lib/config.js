// Shared app config. Change the sidekick name here and it updates everywhere.
// Owner: Person 3 (but anyone can tweak values).

export const SIDEKICK_NAME = "Jepi";

// A topic counts as "mastered" when its score is at or above this.
export const MASTERY_THRESHOLD = 70;

// Daily ring progress values (0 to 100).
export const RING_STUDIED = 50; // studied but not tested yet
export const RING_PASSED = 100; // passed a test

// Key used for localStorage.
export const STORAGE_KEY = "study-sidekick";

// Default number of MCQ questions per quiz.
export const QUIZ_COUNT = 5;

// Theme colors (Tailwind class names). The palette itself is in src/index.css.
export const COLORS = {
  bg: "bg-canvas",
  card: "bg-white",
  text: "text-ink",
  muted: "text-ink/60",
  accent: "text-brand-dark",
  accentBg: "bg-brand",
  good: "bg-brand",
  warn: "bg-coral",
  bad: "bg-danger",
};

// Canvas LMS. Students can change the address on the Add course page.
export const CANVAS_DEFAULT_URL = "https://canvas.sfu.ca";
// Link to our "how to get a Canvas token" YouTube video. Leave "" until it's recorded.
export const CANVAS_TUTORIAL_URL = "";

