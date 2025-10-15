// utils.ts
import PDFParser from "pdf2json";

/**
 * Extracts plain text from a PDF buffer using pdf2json.
 * Works in AWS Lambda (pure JS, no native deps).
 */
export async function extractTextWithPdf2json(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // no `this` usage — instantiate cleanly
    const pdfParser = new PDFParser(undefined, /* needRawText = */ true);

    pdfParser.on("pdfParser_dataError", (err: any) => {
      reject(err?.parserError || err);
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        const pages = pdfData?.formImage?.Pages ?? [];
        const texts: string[] = [];

        for (const page of pages) {
          for (const textBlock of page.Texts ?? []) {
            // textBlock.R is an array of strings with URL-escaped text fragments
            const fragments = (textBlock.R ?? []).map((r: any) =>
              decodeURIComponent(r.T ?? "")
            );
            texts.push(fragments.join(""));
          }
          texts.push("\n");
        }

        const finalText = texts.join(" ").replace(/\s+/g, " ").trim();
        resolve(finalText);
      } catch (e) {
        reject(e);
      }
    });

    // Parse the buffer
    pdfParser.parseBuffer(buffer);
  });
}
