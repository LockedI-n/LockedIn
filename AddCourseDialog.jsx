import { useEffect, useRef, useState } from "react";
import { parseSyllabus } from "../lib/api";
import * as config from "../lib/config";

const SIDEKICK_NAME = config.SIDEKICK_NAME ?? "Sparky";

// Vercel rejects request bodies over ~4.5 MB and base64 adds about a third,
// so keep the file under 3 MB.
const MAX_FILE_BYTES = 3 * 1024 * 1024;

// "CMPT 459" -> "cmpt459" (matches the Course id in the data contract)
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Strip the "data:...;base64," prefix, the API doesn't want it.
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

// Make Gemini's answer match the Course data contract.
function toCourse(id, name, parsed) {
  return {
    id,
    name,
    weights: (parsed?.weights ?? []).map((w) => ({
      item: w.item,
      percent: w.percent,
      date: w.date ?? null,
    })),
    topics: (parsed?.topics ?? []).map((t, i) => ({
      name: t.name,
      week: t.week ?? i + 1,
      summary: t.summary ?? "",
      score: null,
    })),
  };
}

const inputClass =
  "mt-1 w-full rounded-xl bg-white px-3 py-2 ring-1 ring-[#1B1740]/20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4B3FD1]";

// Props:
//   existingIds  ids of courses already added (to block duplicates)
//   onAdd        (course, { fallback }) => void, called when the course is ready
//   onClose      called on cancel, Esc, or a click outside the dialog
export default function AddCourseDialog({ existingIds = [], onAdd, onClose }) {
  const dialogRef = useRef(null);
  const closedRef = useRef(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => {
      closedRef.current = true;
    };
  }, []);

  function onFileChange(e) {
    const picked = e.target.files?.[0] ?? null;
    if (picked && picked.size > MAX_FILE_BYTES) {
      setError("That file is over 3 MB. Try a smaller PDF, or paste the text instead.");
      e.target.value = "";
      setFile(null);
      return;
    }
    setError("");
    setFile(picked);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const courseName = name.trim();
    const id = slugify(courseName);

    if (!id) return setError("Give the course a name, like CMPT 459.");
    if (existingIds.includes(id))
      return setError("You already added a course with that name.");

    setBusy(true);
    setError("");
    try {
      let parsed = null;
      if (file || text.trim()) {
        const payload = { courseName };
        if (text.trim()) payload.text = text.trim();
        if (file) {
          payload.fileBase64 = await fileToBase64(file);
          payload.mimeType = file.type;
        }
        parsed = await parseSyllabus(payload);
      }
      if (closedRef.current) return;
      onAdd(toCourse(id, courseName, parsed), { fallback: !!parsed?.fallback });
    } catch (err) {
      if (closedRef.current) return;
      console.warn("Syllabus failed", err);
      setError(
        "I couldn't read that syllabus. Try again, or remove the file and text to add the course without one."
      );
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="add-course-title"
      className="m-auto w-[min(92vw,32rem)] rounded-3xl bg-[#EEF0FF] p-0 text-[#1B1740] backdrop:bg-[#1B1740]/60"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id="add-course-title" className="text-xl font-bold">
          Add a course
        </h2>
        <p className="mt-1 text-sm text-[#1B1740]/70">
          Add a syllabus and {SIDEKICK_NAME} will pull out your grading weights,
          dates, and topics. You can skip it and add slides later.
        </p>

        <label className="mt-5 block text-sm font-semibold">
          Course name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CMPT 459"
            disabled={busy}
            className={inputClass}
          />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Syllabus file <span className="font-normal">(PDF or image, optional)</span>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={onFileChange}
            disabled={busy}
            className={`${inputClass} text-sm font-normal`}
          />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Or paste the syllabus text <span className="font-normal">(optional)</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            disabled={busy}
            className={`${inputClass} font-normal`}
          />
        </label>

        {error && (
          <p role="alert" className="mt-4 text-sm font-semibold text-[#8A3B00]">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[#1B1740]/20 transition hover:bg-[#1B1740]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B1740]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#FFD23F] px-5 py-2 text-sm font-bold transition hover:brightness-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B1740]"
          >
            {busy ? `${SIDEKICK_NAME} is reading…` : "Add course"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
