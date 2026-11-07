// Upload a syllabus or lecture slides as a PDF, or a screenshot of either.
// mode "pdf": syllabus PDF + slides PDF.  mode "screenshot": one image (grading table, Canvas page, ...).
// Owner: Person 1 (Uploads and Content).

import { parsePDF, looksScanned } from "../../lib/pdfParser.js";
import { parseSyllabus, summarizeSlides } from "../../lib/api.js";
import { shrinkImage } from "../../lib/courses.js";

const PDF_CARDS = [
  ["syllabus", "Syllabus PDF", "Grading weights, dates and weekly topics"],
  ["slides", "Lecture slides PDF", "A short study summary for each topic"],
];
const SHOT_CARDS = [
  ["syllabus", "Screenshot of grades or dates", "e.g. the grading table, or a Canvas page with the midterm date"],
  ["slides", "Photo or screenshot of a slide", "Gets a summary for that topic"],
];

export default function FilePanel({ mode, course, busy, setBusy, onResult, onError }) {
  const isShot = mode === "screenshot";

  async function handleFile(e, kind) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    try {
      let payload;
      if (isShot) {
        if (!file.type.startsWith("image/")) throw new Error("Please choose an image (PNG, JPG or a screenshot).");
        setBusy("Reading your screenshot...");
        const img = await shrinkImage(file);
        payload = kind === "syllabus" ? { fileBase64: img.data, mimeType: img.mimeType } : { images: [img] };
      } else {
        if (file.type !== "application/pdf") throw new Error("Please choose a PDF file.");
        setBusy(`Reading ${file.name}...`);
        let parsed = await parsePDF(file);
        const scanned = looksScanned(parsed.textContent, parsed.numPages);
        if (scanned) {
          setBusy("This PDF looks scanned, so reading the first pages as images...");
          parsed = await parsePDF(file, { images: true });
        }
        payload =
          kind === "syllabus"
            ? scanned
              ? { fileBase64: parsed.pageImages[0]?.data, mimeType: "image/jpeg" }
              : { text: parsed.textContent }
            : scanned
              ? { images: parsed.pageImages }
              : { text: parsed.textContent };
      }

      setBusy(kind === "syllabus" ? "Finding grades, dates and topics..." : "Writing topic summaries...");
      const result =
        kind === "syllabus"
          ? await parseSyllabus({ courseName: course.name, ...payload })
          : await summarizeSlides({ courseName: course.name, topics: course.topics.map((t) => t.name), ...payload });
      onResult(kind, result);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(isShot ? SHOT_CARDS : PDF_CARDS).map(([kind, title, hint]) => (
        <label
          key={kind}
          className={`block cursor-pointer rounded-xl border border-dashed border-slate-700 bg-slate-800/40 p-4 transition hover:border-amber-400 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <div className="font-medium">{title}</div>
          <div className="text-sm text-slate-400">{hint}</div>
          <div className="mt-3 text-xs font-semibold text-amber-400">Choose file</div>
          <input
            type="file"
            accept={isShot ? "image/*" : "application/pdf"}
            className="sr-only"
            disabled={!!busy}
            onChange={(e) => handleFile(e, kind)}
          />
        </label>
      ))}
    </div>
  );
}
