import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * @param {File} file 
 * @returns {Promise<{
 *   textContent: string,
 *   pageImages: { data: string, mimeType: string }[]
 * }>} // returns a promise that resolves to the extracted text content and images from the PDF file    
 */

export async function parsePDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;

        let textContent = '';
        const pageImages = [];
    
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);

            //extract text content from the page 
            const textContentObj = await page.getTextContent();
            const pageText = textContentObj.items.map(item => item.str).join(' '); 
            textContent += pageText + '\n';

            //extract image content from the page
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // renders the page to the canvas 
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const imageDataUrl = canvas.toDataURL("image/png");
            const data = imageDataUrl.split(",")[1];
            
            pageImages.push({ data, mimeType: "image/png" });
        }        

        return {pageImages, textContent}; // returns an object containing the extracted text content and an array of image data URLs for each page

    } catch (error) { // catches an error in case the file given isn't a valid PDF file
        console.error('Error parsing PDF:', error);
        throw new Error("Could not read this PDF file. Please ensure it is a valid PDF and try again.");  
    }   
}
    