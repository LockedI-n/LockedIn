// Add course: build a course from any mix of Canvas, PDFs, screenshots and manual entry.
// Owner: Person 1 (Uploads and Content).
// TODO: course name input, pdf.js text and page images, call parseSyllabus and summarizeSlides from lib/api.js.
import { useState } from 'react';
import { parsePDF } from './pdfParser';
import { parseSyllabus, summarizeSlides } from "../lib/api";

export default function Upload() {
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // handles file upload and parsing
  const handleFileUpload = async (e, documentType) => {
    const file = e.target.files[0];
    if (!file) return;
    
  if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
  }
  if (!courseName) {
      alert('Please enter a course name before uploading.');
      return;
  }

  setLoading(true);
  setStatusMessage(`Uploading ${documentType} for course "${courseName}"...`);

  try {
  const parsedData = await parsePDF(file); // call parsePDF to extract text and images from the uploaded PDF file
  setStatusMessage(`Parsed ${parsedData.pageImages.length} pages and extracted text content.`); // update status message with the number of pages parsed and text content extracted

  let apiResult;

  if (documentType === "syllabus") { // if the document type is syllabus, call parseSyllabus API with course name and extracted text content
    apiResult = await parseSyllabus({
    courseName,
    text: parsedData.textContent,
  });
  } else if (documentType === "slides") {
    apiResult = await summarizeSlides({
    courseName,
    images: parsedData.pageImages,
  });
  } else {
  throw new Error(`Unsupported document type: ${documentType}`);
  }

  setStatusMessage(`API result: ${JSON.stringify(apiResult)}`); // update status message with the API result

  } catch (error) {
    console.error('Error during file upload and parsing:', error);
    setStatusMessage(`Error: ${error.message}`);
  } finally {
    setLoading(false);
    e.target.value = ''; // Reset file input
  }
};



  return (
    <section className="space-y-6">
      <Sidekick mood={sparky.mood} message={sparky.message} />

      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Add a course</h2>
        <p className="text-ink/60">Use one option or combine them. Everything saves as you go.</p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink/80">1. Course name</span>
        <input
          ref={nameRef}
          list="saved-courses"
          value={courseName}
          onChange={(e) => {
            setCourseName(e.target.value);
            setEvent(null);
          }}
          placeholder="e.g. CMPT 455 (or connect Canvas to fill this in)"
          disabled={!!busy}
          className={`w-full rounded-xl bg-white px-4 py-3 text-ink placeholder-ink/40 outline-none ring-1 focus:ring-2 focus:ring-brand ${
            needName && !name ? "ring-2 ring-coral" : "ring-line"
          }`}
        />
        <datalist id="saved-courses">
          {courses.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </label>

      <div className="space-y-2">
      <span className="text-sm font-medium text-ink/80">2. How do you want to add it? Pick one or more</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {OPTIONS.map((o) => {
          const active = open === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pickOption(o.id)}
              className={`rounded-2xl p-4 text-left transition ${
                active ? "bg-brand text-white" : "bg-white ring-1 ring-line hover:ring-brand"
              }`}
            >
              <div className="font-semibold">{o.title}</div>
              <div className={`mt-1 text-xs ${active ? "text-white/85" : "text-ink/60"}`}>{o.hint}</div>
            </button>
          );
        })}
      </div>
      </div>

      {open && !(open !== "canvas" && !name) && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          {open === "canvas" && <CanvasPanel busy={busy} setBusy={setBusy} onImport={onCanvasImport} onError={onError} />}
          {(open === "pdf" || open === "screenshot") && course && (
            <FilePanel mode={open} course={course} busy={busy} setBusy={setBusy} onResult={onFileResult} onError={onError} />
          )}
          {open === "manual" && (
            <p className="text-sm text-ink/80">Add or fix anything in the course below. Dates you add here are used for reminders.</p>
          )}
        </div>
      )}

      {sampleWarning && (
        <p className="rounded-lg bg-coral/20 px-3 py-2 text-sm text-danger-dark">
          The AI was busy, so that last result is sample data. Try the upload again in a minute.
        </p>
      )}

      {course && (saved || open === "manual") && <CourseEditor course={course} onChange={update} manualOpen={open === "manual"} />}

      {saved && (saved.weights.length > 0 || saved.topics.length > 0) && (
        <button
          type="button"
          onClick={() => onNavigate("Dashboard")}
          className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark"
        >
          Done, go to my Dashboard
        </button>
      )}
    </section>
  );
}
