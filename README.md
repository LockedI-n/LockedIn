# Study Sidekick (Streakly)

> *"Meet Sparky, your study sidekick. It reads your syllabus and slides, tells you what to study today, and then makes you prove it."*

Study Sidekick is a study companion for university students, built for the "Digital Sidekick" hackathon theme. A student adds a course and uploads the syllabus, and Gemini pulls out the grading weights, assessment dates, and topics. The student uploads lecture slides or images and gets a short summary per topic. The sidekick sets a daily study habit for each course. After studying, the student proves it with an MCQ quiz, a written answer, or the Feynman method (teaching the sidekick). Progress shows as a daily ring (studied = 50%, passed a test = 100%) and a course mastery bar weighted by grading weight. Low scores turn into tomorrow's habits. All data lives in localStorage. No database, no external course API.

The sidekick's name lives in `src/lib/config.js` (`SIDEKICK_NAME`) and `api/_gemini.js`. Change both if we rename it.

## Tech stack

- React + Vite 6 (JavaScript)
- Tailwind CSS v4 (`@tailwindcss/vite`)
- pdfjs-dist, framer-motion, canvas-confetti
- `@google/genai` (Gemini, server side only)
- Vercel serverless functions in `/api`

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/sultansmoop/Streakly.git
   cd Streakly
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Copy the env file and add your Gemini key (get one free at Google AI Studio):
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` so it says `GEMINI_API_KEY=your_key_here`.
4. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```
5. Run the app:
   ```bash
   vercel dev
   ```
   Use `vercel dev`, not `npm run dev`. Only `vercel dev` runs the `/api` routes locally. The first time it will ask you to link the project.

**No key yet?** That is fine. Every endpoint returns sample data with `fallback: true` when the key is missing or Gemini fails, so you can build the UI right away.

**Never** put the API key in frontend code (`src/`). It is only read in `/api`.

## Folder structure

```
api/
  _gemini.js        shared Gemini helper + sidekick personality prompt
  _samples.js       fallback sample responses
  syllabus.js       POST: extract weights, dates, topics
  slides.js         POST: summarize slides into topics
  quiz.js           POST: generate MCQs for a topic
  grade.js          POST: grade Feynman or written answers
src/
  components/       Sidekick, ProgressRing, MasteryBar, HabitCard
  pages/            Dashboard, Upload, Test
  lib/
    config.js       SIDEKICK_NAME, colors, thresholds (mastery = 70)
    api.js          frontend functions that call /api endpoints
    storage.js      localStorage helpers (loadState / saveState)
    sampleData.js   fake course, habits, quiz, grade for building UI early
  assets/sidekick/  sidekick mood images go here
```

## Data contracts

Everyone builds against these shapes. If you need to change one, tell the team first.

```js
// Course
{
  id: "cmpt459",
  name: "CMPT 459",
  weights: [{ item: "Final", percent: 40, date: "2026-12-10" }],  // date may be null
  topics: [{ name: "Decision Trees", week: 5, summary: "", score: null }]
}

// Habit (one per course per day)
{ id, courseId, topic, date: "YYYY-MM-DD", studied: false, tested: false, score: null }

// Quiz
[{ question: "", options: ["", "", "", ""], answer: 0, explanation: "" }]

// Grade (Feynman or written)
{ score: 72, gotRight: [""], missed: [""], sidekickMessage: "" }

// App state in localStorage under key "study-sidekick"
{ courses: [], habits: [], streaks: {} }
```

Sample data matching these shapes is in `src/lib/sampleData.js`.

## API endpoints

All endpoints are `POST` with a JSON body. Anything else returns `405`. Any response may include `fallback: true`, which means it is sample data.

| Endpoint | Input | Output |
| --- | --- | --- |
| `/api/syllabus` | `{ courseName, text?, fileBase64?, mimeType? }` | `{ weights, topics }` |
| `/api/slides` | `{ courseName, text?, images?: [{ data, mimeType }] }` | `{ topics: [{ name, summary }] }` |
| `/api/quiz` | `{ courseName, topic, summary, count = 4 }` | `{ quiz: [...] }` |
| `/api/grade` | `{ courseName, topic, summary, mode: "feynman" \| "written", answer }` | `{ score, gotRight, missed, sidekickMessage }` |

Notes:
- Base64 data should not include the `data:...;base64,` prefix.
- The syllabus prompt never invents items and uses `null` for unknown dates.
- Call these from the frontend with the helpers in `src/lib/api.js`: `parseSyllabus`, `summarizeSlides`, `getQuiz`, `gradeAnswer`.
- Vercel limits request bodies to about 4.5 MB, so send a few slide images at a time.

## Team split

- **Person 1, Uploads and Content:** upload screen, course setup, pdf.js text and page images, calls `/api/syllabus` and `/api/slides`. Files: `src/pages/Upload.jsx`.
- **Person 2, AI and Backend:** everything in `/api`, prompts, sidekick voice, JSON reliability, fallbacks. Files: `api/`, `src/lib/api.js`.
- **Person 3, Dashboard, Sidekick, Progress:** dashboard, sidekick moods, daily ring, mastery bars, streaks, localStorage, weak topic loop. Files: `src/pages/Dashboard.jsx`, `src/components/`, `src/lib/storage.js`.
- **Person 4, Test Modes and Pitch:** MCQ, Feynman, and written answer screens, polish, demo script, backup recording. Files: `src/pages/Test.jsx`.

## Git workflow

1. Work on your own branch: `git checkout -b yourname/feature`
2. Pull `main` often: `git pull origin main` (then merge it into your branch)
3. Push your branch and open a PR. One person merges into `main`.
4. Never commit `.env` or `.env.local`.

## Checkpoints

- **Hour 3:** syllabus upload shows real topics.
- **Hour 6:** full flow works and is deployed on Vercel.
- **Hour 8:** feature freeze. Only bug fixes and pitch prep after this.
