import mammoth from "mammoth";
import {
  extractSkills,
  extractEducation,
  extractExperiencePdf,
} from "./extractors.js";
import { extractExperience } from "./docx.js";
import { v4 as uuidv4 } from "uuid";
import { setTimeout as sleep } from "timers/promises";
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
import type { EnrichedSkillData, ResumeItem, SeniorityData } from "./types.js";
import { isPdf, normalizeS3PayloadToBuffer } from "./fileHelpers.js";
import { enrichExperienceDurations, totalMonthsMerged } from "./dateHelpers.js";
import { getTechnologyDetail } from "./techTrendsDbService.js";
import { ok, toWeek } from "./techTrendsHelpers.js";
import { log, Ctx } from "./logging.js";
import { canonicalizeTech } from "./techNormalizer.js";
import { topByJobCount } from "./arrayHelpers.js";

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

  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  console.log(extension);
  let text = "";
  let experience: any[] = [];
  if (isPdf(extension, fileType)) {
    const fileBuf = await normalizeS3PayloadToBuffer(s3Object);
    const base64Content = fileBuf.toString("base64");
    try {
      const health = await fetch(
        "https://pypdf-production-e4e9.up.railway.app/health"
      );
    } catch (error) {
      console.warn(error);
    }
    sleep(2000);
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
    console.log(text);
    experience = extractExperience(text);
  } else if (
    extension === "docx" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buf = await normalizeS3PayloadToBuffer(s3Object);
    const fullRes = await mammoth.extractRawText({ buffer: buf });
    text = fullRes.value;
    experience = extractExperience(text);
  } else {
    throw new Error("Unsupported file type");
  }
  const enrichedExperience = enrichExperienceDurations(experience);
  const totalMonths = totalMonthsMerged(enrichedExperience);
  const totalExperienceLabel =
    totalMonths < 24
      ? `${totalMonths} months`
      : `${(totalMonths / 12).toFixed(1)} years`;

  experience = enrichedExperience;

  const isLocalTemp = (x: unknown): x is { filePath: string } =>
    !!x && typeof x === "object" && "filePath" in x;

  if (isLocalTemp(s3Object)) {
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
    totalExperienceLabel,
    totalExperienceMonths: totalMonths,
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

  const techDetails = [];
  let canonTech: string[] = [];
  try {
    canonTech = canonicalizeTech(normalizedSkills?.technologies);
  } catch (err) {
    console.error(err);
  }

  try {
    for (let i = 0; i < canonTech.length; i++) {
      const data = await getTechnologyDetail({
        tech: canonTech[i],
        region: "GLOBAL",
        period: toWeek(new Date()),
      });
      log(undefined, "info", "detail.done", {
        tech: canonTech[i],
        slices: {
          work_mode: data.by_work_mode?.length ?? 0,
          seniority: data.by_seniority?.length ?? 0,
        },
      });
      const techData: EnrichedSkillData = {
        technology: canonTech[i],
        job_count: data?.summary?.job_count,
        salary_median: data?.summary?.salary_median,
        salary_min: data?.summary?.salary_min,
        salary_p75: data?.summary?.salary_p75,
        salary_p95: data?.summary?.salary_p95,
        cooccurring_skills:
          data?.cooccurring_skills ?? data?.summary?.cooccurring_skills,
        industry_distribution:
          data?.industry_distribution ?? data?.summary?.industry_distribution,
        top_titles: data?.top_titles ?? data?.summary?.top_titles,
        by_seniority: data?.by_seniority as SeniorityData,
      };
      log(undefined, "info", "TechData Item", { techData });
      techDetails.push(techData);
    }
  } catch {
    console.error("For Loop Failed");
  }
  console.log(`Tech details Tech Array Length: ${techDetails.length} \n
    Tech Details Array Items: ${JSON.stringify(techDetails)}
    `);

  const userTopTech = topByJobCount(techDetails, techDetails.length);
  console.log(`User Top Tech Array Length: ${userTopTech.length} \n
    User Top Tech Items: ${JSON.stringify(userTopTech)}
    `);
  const { parsed, insightsItem } = await genInsightsWithBedrock(
    text,
    resumeId,
    userTopTech
  );
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

  return {
    resumeId,
    contactInfo,
    skills: normalizedSkills,
    education,
    experience,
    insights,
  };
}
