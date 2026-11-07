// Upload: add a course, upload syllabus and slides.
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
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Upload</h2>
      <label>
        Course name
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          disabled={loading}
        />
      </label>

      <label>
        Syllabus PDF
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFileUpload(e, "syllabus")}
          disabled={loading}
        />
      </label>

      <label>
        Slides PDF
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFileUpload(e, "slides")}
          disabled={loading}
        />
      </label>

      {loading && <p>Processing PDF…</p>}
      {statusMessage && <p role="status">{statusMessage}</p>}
    </section>
  );
}
