# Person 2: AI and Backend Notes

Owner: Person 2. Only Person 2 edits this file. Teammates can read it to see what the backend does and what changed.

My files: everything in `api/`, plus `src/lib/api.js`.

---

## Endpoint status

Update this table as things change. Status options: Stub (sample only), Working, Tested, Polished.

| Endpoint | Status | Tested with real key? | Notes |
| --- | --- | --- | --- |
| `/api/syllabus` | Stub | No | Prompt written, untested |
| `/api/slides` | Stub | No | Prompt written, untested |
| `/api/quiz` | Stub | No | Drops questions without exactly 4 options |
| `/api/grade` | Stub | No | Feynman and written modes, score kept between 0 and 100 |

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

---

## Test log

Inputs I tried and what came back. Use real syllabi and slides from our own courses.

| Hour | Endpoint | Input (file or short description) | Result | Problem? |
| --- | --- | --- | --- | --- |
| | | | | |

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
- Model name `gemini-2.5-flash` in `api/_gemini.js`. Check AI Studio for the latest Flash model.
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

- [ ] Get a Gemini key and add it to `.env.local`
- [ ] Run `vercel dev` and test each endpoint with a real key
- [ ] Test `/api/syllabus` with 2 or 3 real syllabi (Hour 3 checkpoint)
- [ ] Test `/api/slides` with real lecture slides
- [ ] Make quiz questions match the topic summary closely
- [ ] Tune Feynman grading so it is honest but not harsh
- [ ] Add the Gemini key to Vercel project settings before deploying (Hour 6 checkpoint)
- [ ] Help Person 4 with a backup plan if the API is slow during the demo
