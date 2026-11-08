// Read the text out of a PowerPoint (.pptx) file in the browser.
// A .pptx is a zip; each slide is ppt/slides/slideN.xml and its text lives in <a:t> tags.
// Speaker notes (ppt/notesSlides/) are included too, since lecturers often put detail there.
// Owner: Person 1 (Uploads and Content).

import JSZip from "jszip";

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// Text of one slide XML: each paragraph (<a:p>) on its own line.
function slideText(xml) {
  return xml
    .split(/<\/a:p>/)
    .map((para) => [...para.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1])).join(""))
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

const slideNumber = (path) => Number(path.match(/(\d+)\.xml$/)?.[1] ?? 0);

/**
 * @param {File} file a .pptx file
 * @returns {Promise<{ textContent: string, numPages: number }>} same shape as parsePDF (pages = slides)
 */
export async function parsePPTX(file) {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slides = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => slideNumber(a) - slideNumber(b));
    if (!slides.length) throw new Error("no slides");

    let textContent = "";
    for (const path of slides) {
      const n = slideNumber(path);
      const text = slideText(await zip.file(path).async("string"));
      const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
      const notes = notesFile ? slideText(await notesFile.async("string")) : "";
      textContent += `--- Slide ${n} ---\n${text}\n${notes ? `Notes: ${notes}\n` : ""}`;
    }
    return { textContent, numPages: slides.length };
  } catch (err) {
    console.error("Error parsing PowerPoint:", err);
    throw new Error("Could not read this PowerPoint. Make sure it's a .pptx file (old .ppt files aren't supported).");
  }
}

export const isPPTX = (file) =>
  /\.pptx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
