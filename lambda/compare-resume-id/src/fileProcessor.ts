import mammoth from "mammoth";
import {
  extractSkills,
  extractEducation,
  extractExperience,
} from "./extractors";
import { v4 as uuidv4 } from "uuid";
import { insertResume } from "./dbService";
import {
  genInsightsWithBedrock,
  normalizeSkillsWithBedrock,
} from "./aiService";

import { extractTextWithPdf2json } from "./utils";
export async function processFile(buffer: Buffer, key: string) {
  const resumeId = uuidv4();

  // 1️⃣ Determine file type
  const extension = key.split(".").pop()?.toLowerCase() || "";
  let text = "";

  if (extension === "pdf") {
    // Dynamic import - loads only when needed

    const text = await extractTextWithPdf2json(buffer);
  } else if (extension === "docx") {
    // DOCX extraction
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    throw new Error("Unsupported file type");
  }

  const contactInfo = {
    email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null,
    phone: text.match(/(\+?\d[\d -]{8,}\d)/)?.[0] || null,
  };
  const rawSkills = extractSkills(text);
  const education = extractEducation(text);
  const experience = extractExperience(text);

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
    size: buffer.length,
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
