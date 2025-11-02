import mammoth from "mammoth";
import {
  extractSkills,
  extractEducation,
  extractExperiencePdf,
} from "./extractors.js";
import { extractExperience } from "./docx.js";
import { v4 as uuidv4 } from "uuid";
import {
  getResumeByS3Key,
  insertResumeWithInsights,
  updateResume,
} from "./dbService.js";
import {
  genInsightsWithBedrock,
  normalizeSkillsWithBedrock,
} from "./aiService.js";
import { getS3Object } from "./s3Service.js";
import fs from "fs";
import type { ResumeItem } from "./types.js";

interface PDFResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export async function processFile(key: string) {
  const s3Object = await getS3Object(key);
  console.log("S3 object retrieved for key:", s3Object);
  const resumeBaseItem = await getResumeByS3Key(key);
  const resumePK = resumeBaseItem.PK;
  const resumeId = resumeBaseItem.SK;
  const fileName = resumeBaseItem.originalFileName;
  const fileType = resumeBaseItem.contentType;
  // 1️⃣ Determine file type
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
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
  } else if (
    extension === "docx" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const fullRes = await mammoth.extractRawText({ buffer: s3Object });
    text = fullRes.value;
    experience = extractExperience(text);
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

  const normalizedSkills = await normalizeSkillsWithBedrock(
    rawSkills,
    text,
    resumeId
  );

  const resumeItem = {
    PK: resumePK,
    SK: resumeId,
    contactInfo,
    skills: normalizedSkills,
    education,
    experience,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  console.log(
    "Resume item prepared, updating resume in database with : ",
    resumeItem
  );
  const updatedResumeItem = await updateResume(resumeItem);
  console.log("Resume item updated in database:", updatedResumeItem);
  console.log("Generating insights for resume ID:", resumeId);
  const { parsed, insightsItem } = await genInsightsWithBedrock(text, resumeId);
  const insights = parsed;
  console.log("Insights generated:", insights);
  const fullResumeItem: ResumeItem = {
    ...updatedResumeItem,
    s3Key: key,
    contentType: fileType,
    originalFileName: fileName,
    uploadInitiatedAt: resumeBaseItem.uploadInitiatedAt,
  };
  console.log("Full resume item prepared:", fullResumeItem);
  await insertResumeWithInsights(fullResumeItem, insightsItem);
  console.log("Resume with insights inserted into database.");
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
