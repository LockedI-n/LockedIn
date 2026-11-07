# Person 2: AI and Backend Notes

Owner: Person 2. Only Person 2 edits this file. Teammates can read it to see what the backend does and what changed.

My files: everything in `api/`, plus `src/lib/api.js`.

---

## Endpoint status

Update this table as things change. Status options: Stub (sample only), Working, Tested, Polished.

| Endpoint | Status | Tested with real key? | Notes |
| --- | --- | --- | --- |
| `/api/syllabus` | Working | Yes (sample text) | Weights, dates, topics correct; unknown dates stay null |
| `/api/slides` | Working | Yes (lecture text) | Good per-topic summaries, nothing invented. Images not tested yet |
| `/api/quiz` | Working | Yes | Drops questions without exactly 4 options |
| `/api/grade` | Working | Yes | Fair scores (good answer 75-80, wrong answer 0-5). Sparky asks a follow-up in Feynman mode |

---

## Contracts (do not change without telling the team)

Full shapes are in the main `README.md`. Every response can include `fallback: true` when sample data is used.

If I ever need to change a shape, log it here first:

| Date / Hour | Change | Who I told |
| --- | --- | --- |
| | | |

---

## Prompt changelog

Write down every prompt change and why, so we can undo it if results get worse.

| Hour | Endpoint | What I changed | Why | Better or worse? |
| --- | --- | --- | --- | --- |
| 0 | all | First versions written | Starter setup | Not tested yet |
| 1 | all | Model `gemini-2.5-flash` to `gemini-3.8-flash`; retry up to 3 times on 503/429 | 2.5 is closed to new keys; Gemini often says "high demand" | Better: real responses now |
| 1 | all | Model list: `gemini-3.6-flash`, then `3.5-flash`, then `3.5-flash-lite`. Busy model moves to the next one | `gemini-3.8-flash` took 130-210 s per call | Much better: 6-15 s per call |

---

## Test log

Inputs I tried and what came back. Use real syllabi and slides from our own courses.

| Hour | Endpoint | Input (file or short description) | Result | Problem? |
| --- | --- | --- | --- | --- |
| 1 | quiz | Decision trees, short summary, count 2 | 2 good on-topic MCQs | First try got 503 (high demand) |
| 1 | syllabus | Made-up CMPT 459 syllabus text | All 4 weights, 2 dates, 5 topics correct; final date null | None. Still need a real syllabus PDF |
| 1 | slides | 5 slides of clustering text | 4 accurate topics | Took 199 s on 3.8-flash (fixed by model list) |
| 1 | grade | Feynman, decent k-means answer | 80, missed "how to choose k" | Took 141 s on 3.8-flash (fixed) |
| 1 | grade | Written, wrong answer ("supervised") | 5, explained why | None |
| 1 | syllabus | Dates with no year ("Oct 21") | Dates came back null | Correct, it does not guess the year. Real syllabi usually say the term |

---

## Sidekick voice

Current personality (from `SIDEKICK` in `api/_gemini.js`):
- Friendly and upbeat, but honest
- Short messages (1 to 3 sentences), casual and specific
- Never makes up facts about the course

Feynman mode: acts like a curious friend being taught, says what it understood, and asks about the confusing part.

Ideas and examples of good or bad sidekick messages:
-

---

## Known issues and risks

- Vercel request body limit is about 4.5 MB. Large PDFs or many slide images may fail. Option: send pages in batches, or send text from pdf.js instead of the file.
- Models are listed in `MODELS` in `api/_gemini.js`. `gemini-2.5-flash` returns 404 for new keys. `gemini-3.8-flash` is very slow (2-3 min).
- Gemini often returns 503 "high demand". `askJSON` moves to the next model; if all are busy, the endpoint falls back to sample data.
- `vercel dev` does not pass `.env.local` to the API functions. Start it with: `set -a; source .env.local; set +a; npx vercel dev`
- Global `npm i -g vercel` fails on my Mac (permissions). Use `npx vercel ...` instead.
- Free tier rate limits. If we hit them during the demo, fallbacks kick in (check for `fallback: true`).
-

---

## Decisions

Things I decided and why, so I can explain them in the pitch or to judges.

- Gemini is called only from `/api`, so the key never reaches the browser.
- Every endpoint falls back to sample data so the frontend is never blocked and the demo never crashes.
- JSON mode (`responseMimeType: "application/json"`) plus checking the result before it goes back to the frontend.
-

---

## TODO

- [x] Get a Gemini key and add it to `.env.local`
- [x] Link Vercel project `lockedin` (live: https://lockedin-seven-xi.vercel.app)
- [x] Test `/api/slides` and `/api/grade` with a real key
- [ ] Test `/api/slides` with slide images (not just text)
- [ ] Test `/api/syllabus` with 2 or 3 real syllabi (Hour 3 checkpoint)
- [ ] Test `/api/slides` with real lecture slides
- [ ] Make quiz questions match the topic summary closely
- [ ] Tune Feynman grading so it is honest but not harsh
- [ ] Add the Gemini key to Vercel project settings before deploying (Hour 6 checkpoint)
- [ ] Help Person 4 with a backup plan if the API is slow during the demo
