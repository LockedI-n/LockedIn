// Read a PDF in the browser with pdf.js.
// Owner: Person 1 (Uploads and Content).

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * Extract text (and optionally page images) from a PDF file.
 *
 * Images are off by default: rendering every page is slow, and sending many
 * page images at once goes over Vercel's ~4.5 MB request limit. Text is
 * enough for normal syllabi and slides. Use images only for scanned PDFs.
 *
 * @param {File} file
 * @param {{ images?: boolean, maxImages?: number }} [options]
 * @returns {Promise<{
 *   textContent: string,
 *   numPages: number,
 *   pageImages: { data: string, mimeType: string }[]
 * }>}
 */
export async function parsePDF(file, { images = false, maxImages = 6 } = {}) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let textContent = "";
    const pageImages = [];

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);

      // extract text content from the page
      const textContentObj = await page.getTextContent();
      const pageText = textContentObj.items.map((item) => item.str).join(" ");
      textContent += `--- Page ${pageNum} ---\n${pageText}\n`;

      // optionally render the page as a small JPEG (only the first few pages)
      if (images && pageImages.length < maxImages) {
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        const data = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        pageImages.push({ data, mimeType: "image/jpeg" });
      }
    }

    return { textContent, numPages: pdfDocument.numPages, pageImages };
  } catch (error) {
    // the file given isn't a valid PDF
    console.error("Error parsing PDF:", error);
    throw new Error("Could not read this PDF file. Please ensure it is a valid PDF and try again.");
  }
}

// True when a PDF has almost no real text (likely a scan), so images are needed.
export function looksScanned(textContent, numPages) {
  const letters = textContent.replace(/--- Page \d+ ---/g, "").replace(/\s+/g, "").length;
  return letters < 40 * numPages;
}
