// Shared app config. Change the sidekick name here and it updates everywhere.
// Owner: Person 3 (but anyone can tweak values).

export const SIDEKICK_NAME = "Sparky";

// A topic counts as "mastered" when its score is at or above this.
export const MASTERY_THRESHOLD = 70;

// Daily ring progress values (0 to 100).
export const RING_STUDIED = 50; // studied but not tested yet
export const RING_PASSED = 100; // passed a test

// Key used for localStorage.
export const STORAGE_KEY = "study-sidekick";

// Default number of MCQ questions per quiz.
export const QUIZ_COUNT = 4;

// Theme colors (Tailwind class names, so they work with className).
export const COLORS = {
  bg: "bg-slate-950",
  card: "bg-slate-900",
  text: "text-slate-100",
  muted: "text-slate-400",
  accent: "text-amber-400",
  accentBg: "bg-amber-400",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
};

// Canvas LMS. Students can change the address on the Add course page.
export const CANVAS_DEFAULT_URL = "https://canvas.sfu.ca";
// Link to our "how to get a Canvas token" YouTube video. Leave "" until it's recorded.
export const CANVAS_TUTORIAL_URL = "";

