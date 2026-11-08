// Upload a syllabus or lecture slides (PDF or PowerPoint), or screenshots of either.
// Several files can be picked at once; they're processed one after another.
// mode "pdf": documents.  mode "screenshot": images (grading table, Canvas page, slide photo).
// Owner: Person 1 (Uploads and Content).

import { parsePDF, looksScanned } from "../../lib/pdfParser.js";
import { parsePPTX, isPPTX } from "../../lib/pptxParser.js";
import { parseSyllabus, summarizeSlides } from "../../lib/api.js";
import { shrinkImage } from "../../lib/courses.js";

const DOC_ACCEPT = ".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";

const DOC_CARDS = [
  ["syllabus", "Syllabus", "PDF or PowerPoint. Grading, dates and weekly topics"],
  ["slides", "Lecture slides", "PDF or PowerPoint, as many as you like. A summary per topic"],
];
const SHOT_CARDS = [
  ["syllabus", "Screenshots of grades or dates", "e.g. the grading table, or a Canvas page with the midterm date"],
  ["slides", "Photos or screenshots of slides", "Gets a summary for those topics"],
];

// Turn one file into what the API needs: { text } or { fileBase64, mimeType } or { images }.
async function readFile(file, kind, setBusy) {
  if (file.type.startsWith("image/")) {
    const img = await shrinkImage(file);
    return kind === "syllabus" ? { fileBase64: img.data, mimeType: img.mimeType } : { images: [img] };
  }
  if (isPPTX(file)) {
    const { textContent } = await parsePPTX(file);
    return { text: textContent };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    let parsed = await parsePDF(file);
    if (looksScanned(parsed.textContent, parsed.numPages)) {
      setBusy(`${file.name} looks scanned, so I'm reading the first pages as images...`);
      parsed = await parsePDF(file, { images: true });
      return kind === "syllabus"
        ? { fileBase64: parsed.pageImages[0]?.data, mimeType: "image/jpeg" }
        : { images: parsed.pageImages };
    }
    return { text: parsed.textContent };
  }
  throw new Error(`${file.name}: please use a PDF, a PowerPoint (.pptx) or an image.`);
}

export default function FilePanel({ mode, courseName, getTopics, busy, setBusy, onResult, onError }) {
  const isShot = mode === "screenshot";

  async function handleFiles(e, kind) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;

    const failed = [];
    for (const [i, file] of files.entries()) {
      const of = files.length > 1 ? ` (${i + 1} of ${files.length})` : "";
      try {
        setBusy(`Reading ${file.name}${of}...`);
        const payload = await readFile(file, kind, setBusy);
        setBusy(kind === "syllabus" ? `Finding grades, dates and topics in ${file.name}${of}...` : `Writing topic summaries for ${file.name}${of}...`);
        const result =
          kind === "syllabus"
            ? await parseSyllabus({ courseName, ...payload })
            : await summarizeSlides({ courseName, topics: getTopics(), ...payload });
        onResult(kind, result);
      } catch (err) {
        failed.push(err.message);
      }
    }
    setBusy("");
    if (failed.length) onError(failed.join(" "));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(isShot ? SHOT_CARDS : DOC_CARDS).map(([kind, title, hint]) => (
        <label
          key={kind}
          className={`group block cursor-pointer rounded-2xl border-2 border-dashed border-line bg-canvas p-5 transition hover:border-brand hover:bg-white ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-sm text-ink/60">{hint}</div>
          <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white transition group-hover:bg-brand-dark">
            Choose files
          </div>
          <input
            type="file"
            multiple
            accept={isShot ? "image/*" : DOC_ACCEPT}
            className="sr-only"
            disabled={!!busy}
            onChange={(e) => handleFiles(e, kind)}
          />
        </label>
      ))}
    </div>
  );
}
