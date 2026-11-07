// POST /api/canvas
// Talks to a university's Canvas LMS for the student, using their personal access token.
// Canvas blocks requests made straight from a web page (CORS), so the browser calls this instead.
// The token is only passed through to Canvas. It is never stored or logged.
//
// Input:  { baseUrl: "https://canvas.sfu.ca", token, action: "courses" }
//      -> { courses: [{ id, name, code }] }
// Input:  { baseUrl, token, action: "course", courseId }
//      -> { course: { name, weights: [{ item, percent, date }] } }
//         Each Canvas assignment becomes one weight item. percent is its share of the
//         final grade (from assignment group weights, or from points if the course isn't weighted).
// Errors: { error: "message the student can read" } with status 400 / 401 / 502.
// Owner: Person 2 (AI and Backend).

import { readBody } from "./_gemini.js";

// Only talk to Canvas servers, so this can't be used to call arbitrary URLs.
function cleanBaseUrl(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    const host = url.hostname.toLowerCase();
    const looksLikeCanvas = host.includes("canvas") || host.endsWith(".instructure.com");
    if (url.protocol !== "https:" || !looksLikeCanvas) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

class CanvasError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// GET a Canvas API path, following pagination (Link: rel="next") for a few pages.
async function canvasGet(base, token, path, maxPages = 5) {
  let url = `${base}/api/v1${path}`;
  let results = [];
  for (let page = 0; url && page < maxPages; page++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new CanvasError(401, "Canvas didn't accept that token. Check it was copied fully, or make a new one.");
    if (res.status === 403) throw new CanvasError(403, "Canvas says you don't have access to this.");
    if (!res.ok) throw new CanvasError(502, `Canvas returned an error (${res.status}). Try again in a moment.`);
    const data = await res.json();
    if (!Array.isArray(data)) return data; // single object, no pagination
    results = results.concat(data);
    const next = (res.headers.get("link") || "").split(",").find((part) => part.includes('rel="next"'));
    url = next ? next.match(/<([^>]+)>/)?.[1] : null;
  }
  return results;
}

// "2026-10-22T06:59:00Z" -> "2026-10-21" in the course's time zone.
function toLocalDate(iso, timeZone) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: timeZone || "America/Vancouver" });
  } catch {
    return iso.slice(0, 10);
  }
}

const round1 = (n) => Math.round(n * 10) / 10;

export function weightsFromGroups(groups, { weighted, timeZone }) {
  const allPoints = groups.flatMap((g) => g.assignments ?? []).reduce((sum, a) => sum + (a.points_possible || 0), 0);
  const weights = [];

  for (const group of groups) {
    const assignments = (group.assignments ?? []).filter((a) => a.published !== false);
    if (!assignments.length) continue;
    const groupPoints = assignments.reduce((sum, a) => sum + (a.points_possible || 0), 0);

    for (const a of assignments) {
      const pts = a.points_possible || 0;
      let percent = 0;
      if (weighted) {
        const share = groupPoints > 0 ? pts / groupPoints : 1 / assignments.length;
        percent = (group.group_weight || 0) * share;
      } else if (allPoints > 0) {
        percent = (100 * pts) / allPoints;
      }
      const date = toLocalDate(a.due_at, timeZone);
      if (percent <= 0 && !date) continue; // ungraded and undated: not useful
      weights.push({ item: a.name, percent: round1(percent), date, group: group.name });
    }
  }
  return weights;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { baseUrl, token, action, courseId } = readBody(req);
  const base = cleanBaseUrl(baseUrl);
  if (!base) return res.status(400).json({ error: "Enter your Canvas address, like https://canvas.sfu.ca" });
  if (!token || typeof token !== "string" || token.length < 10) {
    return res.status(400).json({ error: "Paste your Canvas access token first." });
  }

  try {
    if (action === "courses") {
      const list = await canvasGet(base, token, "/courses?enrollment_state=active&per_page=50");
      const courses = list
        .filter((c) => c && c.id && c.name && !c.access_restricted_by_date)
        .map((c) => ({ id: c.id, name: c.name, code: c.course_code || "" }));
      return res.status(200).json({ courses });
    }

    if (action === "course") {
      if (!courseId) return res.status(400).json({ error: "Pick a course first." });
      const id = encodeURIComponent(courseId);
      const [course, groups] = await Promise.all([
        canvasGet(base, token, `/courses/${id}`),
        canvasGet(base, token, `/courses/${id}/assignment_groups?include[]=assignments&per_page=50`),
      ]);
      const weights = weightsFromGroups(Array.isArray(groups) ? groups : [], {
        weighted: Boolean(course.apply_assignment_group_weights),
        timeZone: course.time_zone,
      });
      return res.status(200).json({ course: { name: course.course_code || course.name, weights } });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    if (err instanceof CanvasError) return res.status(err.status).json({ error: err.message });
    console.error("canvas error:", err?.message);
    return res.status(502).json({ error: "Couldn't reach Canvas. Check the address and try again." });
  }
}
