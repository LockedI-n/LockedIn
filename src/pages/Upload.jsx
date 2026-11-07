// Upload: add a course, upload syllabus and slides.
// Owner: Person 1 (Uploads and Content).
//
// Flow: pick a course name -> upload syllabus (weights, dates, topics)
//       -> upload slides (a summary for each topic) -> saved for the dashboard.

import { useState } from "react";
import { parsePDF, looksScanned } from "../lib/pdfParser.js";
import { parseSyllabus, summarizeSlides } from "../lib/api.js";
import { loadState, updateState, upsertCourse } from "../lib/storage.js";

// "CMPT 455" -> "cmpt455"
const courseIdFor = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "") || "course";

// Put slide summaries onto the course's topics (matched by name, ignoring case).
// Topics the syllabus didn't list are added at the end.
function mergeSummaries(topics, slideTopics) {
  const merged = topics.map((t) => ({ ...t }));
  for (const st of slideTopics) {
    const match = merged.find((t) => t.name.toLowerCase() === st.name.toLowerCase());
    if (match) match.summary = match.summary ? `${match.summary} ${st.summary}` : st.summary;
    else merged.push({ name: st.name, week: null, summary: st.summary, score: null });
  }
  return merged;
}

export default function Upload() {
  const [courses, setCourses] = useState(() => loadState().courses);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [usedSample, setUsedSample] = useState(false);

  const course = courses.find((c) => c.id === courseIdFor(courseName.trim()));

  // handles file upload and parsing
  const handleFileUpload = async (e, documentType) => {
    const file = e.target.files[0];
    if (!file) return;

    const name = courseName.trim();
    if (file.type !== "application/pdf") {
      setStatusMessage("Please upload a PDF file.");
      e.target.value = "";
      return;
    }
    if (!name) {
      setStatusMessage("Enter a course name before uploading.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    setUsedSample(false);
    setStatusMessage(`Reading ${file.name}...`);

    try {
      // 1. Read the PDF. Only render page images if it looks like a scan.
      let parsed = await parsePDF(file);
      const scanned = looksScanned(parsed.textContent, parsed.numPages);
      if (scanned) {
        setStatusMessage("This PDF looks scanned, so reading the first few pages as images...");
        parsed = await parsePDF(file, { images: true });
      }

      // 2. Send it to the AI.
      setStatusMessage(`Read ${parsed.numPages} pages. Sparky is reading your ${documentType}...`);
      const id = courseIdFor(name);
      const existing = loadState().courses.find((c) => c.id === id);
      const base = existing ?? { id, name, weights: [], topics: [] };
      let updated;

      if (documentType === "syllabus") {
        const result = await parseSyllabus({ courseName: name, text: parsed.textContent });
        setUsedSample(Boolean(result.fallback));
        // Keep summaries from slides uploaded earlier.
        const oldSummaries = Object.fromEntries(base.topics.map((t) => [t.name.toLowerCase(), t.summary]));
        updated = {
          ...base,
          name,
          weights: result.weights ?? [],
          topics: (result.topics ?? []).map((t) => ({
            ...t,
            summary: t.summary || oldSummaries[t.name.toLowerCase()] || "",
          })),
        };
      } else {
        const result = await summarizeSlides({
          courseName: name,
          text: scanned ? "" : parsed.textContent,
          images: scanned ? parsed.pageImages : [],
          topics: base.topics.map((t) => t.name), // so summaries match the syllabus topics
        });
        setUsedSample(Boolean(result.fallback));
        updated = { ...base, name, topics: mergeSummaries(base.topics, result.topics ?? []) };
      }

      // 3. Save it so the dashboard and tests can use it.
      const next = updateState((s) => upsertCourse(s, updated));
      setCourses(next.courses);
      setStatusMessage(
        documentType === "syllabus"
          ? `Saved ${name}: ${updated.weights.length} graded items and ${updated.topics.length} topics.`
          : `Saved slide summaries for ${name}.`
      );
    } catch (error) {
      console.error("Error during file upload and parsing:", error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      e.target.value = ""; // reset file input
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Upload</h2>
        <p className="text-slate-400">Add a course, then upload its syllabus and lecture slides (PDF).</p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-300">Course name</span>
        <input
          list="saved-courses"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="e.g. CMPT 455"
          disabled={loading}
          className="w-full rounded-lg bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <datalist id="saved-courses">
          {courses.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["syllabus", "1. Syllabus", "Grading weights, dates and topics"],
          ["slides", "2. Lecture slides", "A short summary for each topic"],
        ].map(([type, title, hint]) => (
          <label
            key={type}
            className={`block cursor-pointer rounded-xl border border-dashed border-slate-700 bg-slate-900 p-4 hover:border-amber-400 ${
              loading || !courseName.trim() ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <div className="font-medium">{title}</div>
            <div className="text-sm text-slate-400">{hint}</div>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={loading || !courseName.trim()}
              onChange={(e) => handleFileUpload(e, type)}
            />
          </label>
        ))}
      </div>

      {statusMessage && (
        <p className={`text-sm ${statusMessage.startsWith("Error") ? "text-red-400" : "text-slate-300"}`}>
          {loading && <span className="mr-2 inline-block animate-pulse">●</span>}
          {statusMessage}
        </p>
      )}
      {usedSample && (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
          The AI was unavailable, so sample data was used. Try again in a minute.
        </p>
      )}

      {course && (
        <div className="space-y-4 rounded-xl bg-slate-900 p-4">
          <h3 className="font-semibold">{course.name}</h3>

          {course.weights?.length > 0 && (
            <div>
              <div className="mb-1 text-sm font-medium text-slate-300">Grading</div>
              <ul className="space-y-1 text-sm">
                {course.weights.map((w) => (
                  <li key={w.item} className="flex justify-between gap-4">
                    <span>{w.item}</span>
                    <span className="text-slate-400">
                      {w.percent}%{w.date ? ` · ${w.date}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {course.topics?.length > 0 && (
            <div>
              <div className="mb-1 text-sm font-medium text-slate-300">Topics</div>
              <ul className="space-y-1 text-sm">
                {course.topics.map((t) => (
                  <li key={t.name} className="flex justify-between gap-4">
                    <span>
                      {t.week != null && <span className="text-slate-500">Week {t.week} · </span>}
                      {t.name}
                    </span>
                    <span className={t.summary ? "text-emerald-400" : "text-slate-500"}>
                      {t.summary ? "summary ready" : "needs slides"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
