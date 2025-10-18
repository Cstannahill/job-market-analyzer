import mammoth from "mammoth";
import {
  extractSkills,
  extractEducation,
  extractExperiencePdf,
} from "./extractors.js";
import { extractExperience } from "./docx.js";
import { randomUUID } from "crypto";
import { insertResume } from "./dbService.js";
import {
  genInsightsWithBedrock,
  normalizeSkillsWithBedrock,
} from "./aiService.js";
import { getS3Object } from "./s3Service.js";
import fs from "fs";

interface PDFResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export async function processFile(key: string) {
  const s3Object = await getS3Object(key);
  const resumeId = randomUUID();

  // 1️⃣ Determine file type
  const extension = key.split(".").pop()?.toLowerCase() || "";
  let text = "";
  let experience: any[] = [];
  if ("filePath" in s3Object) {
    // Read file and encode to base64
    const fileBuffer = fs.readFileSync(s3Object.filePath);
    const base64Content = fileBuffer.toString("base64");

    const response = await fetch(
      "https://pypdf-production-e4e9.up.railway.app/extract/pdf-buffer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buffer: base64Content,
          filename: key.split("/").pop() || "resume.pdf",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `PDF API returned ${response.status}: ${await response.text()}`
      );
    }

    const data = (await response.json()) as PDFResponse;

    if (!data.success || !data.text) {
      throw new Error(
        `PDF extractor failed: ${data.error || "No text returned"}`
      );
    }

    text = data.text;
    experience = extractExperiencePdf(text);
  } else if (extension === "docx") {
    // DOCX extraction
    // const result = await mammoth.extractRawText({ buffer: s3Object });
    // const html = result.value; // use mammoth's HTML (contains <p>, <br>, etc.)
    // experience = extractExperienceHTML(html);
    const fullRes = await mammoth.extractRawText({ buffer: s3Object });
    text = fullRes.value;
    experience = extractExperience(text);
    // experience = extractExperienceHTML(text);
  } else {
    throw new Error("Unsupported file type");
  }

  if ("filePath" in s3Object) {
    fs.unlink(s3Object.filePath, () => {});
  }
  const contactInfo = {
    email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null,
    phone: text.match(/(\+?\d[\d -]{8,}\d)/)?.[0] || null,
  };
  const rawSkills = extractSkills(text);
  const education = extractEducation(text);
  // const experience = extractExperience(text);

  const normalizedSkills = await normalizeSkillsWithBedrock(
    rawSkills,
    text,
    resumeId
  );

  const resumeItem = {
    PK: `RESUME#${resumeId}`,
    SK: "PARSED",
    resumeId,
    filename: key.split("/").pop(),
    // size: { buffer ?buffer.length },
    contactInfo,
    skills: normalizedSkills, // Use normalized version
    education,
    experience,
    createdAt: new Date().toISOString(),
  };

  await insertResume(resumeItem);
  const insights = await genInsightsWithBedrock(text, resumeId);
  // 5️⃣ Return summary
  return {
    resumeId,
    contactInfo,
    skills: normalizedSkills,
    education,
    experience,
    insights,
  };
}
