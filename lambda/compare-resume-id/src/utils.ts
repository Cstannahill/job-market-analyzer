interface PdfApiResponse {
  success: boolean;
  filename: string;
  text?: string;
  page_count?: number;
  error?: string;
  timestamp: string;
}

export async function extractTextWithApi(file: File, filename: string) {
  // Convert Buffer to base64

  const response = await fetch("https://py-pdf.onrender.com/extract/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: file,
      filename,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PDF API request failed: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as PdfApiResponse;

  if (!data.success) {
    throw new Error(`PDF API extraction failed: ${data.error}`);
  }

  return data.text;
}
