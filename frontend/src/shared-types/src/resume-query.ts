// resume-record.ts

/** ---------- Common enums & aliases ---------- */
export type IsoDateString = string; // e.g., "2025-11-07T19:42:34.693Z"

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "failed";
export type ConfidenceLevel = "low" | "medium" | "high";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type ContentType = "DOCX" | "PDF";

/** ---------- Top-level record ---------- */
export interface ResumeRecord {
  experience: ResumeExperienceItem[];
  insightId: string; // e.g. "INSIGHT#uuid"
  status: ProcessingStatus;

  uploadInitiatedAt: IsoDateString;
  uploadedAt: IsoDateString;
  updatedAt: IsoDateString;

  contentType: string; // e.g. "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  originalFileName: string;

  contactInfo: ContactInfo;
  education: ResumeEducationItem[];

  // Dynamo keys
  PK: string; // e.g. "USER#<uuid>"
  SK: string; // e.g. "RESUME#<uuid>"

  s3Key: string;

  // Skill normalization snapshot (flat lists from earlier pipeline step)
  skills: FlatSkills;

  // Final, structured insights (parsed object)
  insights: ResumeInsights;

  // If some items still carry the raw JSON text version, allow it (optional)
  insightsText?: string;

  // Metadata about the insights generation
  insightsMetadata: {
    generatedAt: IsoDateString;
    generatedBy: string; // e.g. "amazon.nova-pro-v1:0"
  };
}

/** ---------- Sub-types ---------- */

export interface ResumeExperienceItem {
  duration: string; // "Apr 2024 – Present"
  description: string[]; // bullet points
  company: string;
  location: string;
  title: string;
}

export interface ContactInfo {
  phone: string | null;
  email: string | null;
}

export interface ResumeEducationItem {
  name: string;
  type: string; // e.g., "bootcamp", "bachelor", etc.
}

/** Flat skills block (from your `skills` property) */
export interface FlatSkills {
  technologies: string[];
  softSkills: string[];
  reasoning: string;
}

export type Summary = {
  oneLine: string;
  threeLine: string;
};
/** ---------- Insights tree ---------- */

export interface ResumeInsights {
  summary: Summary;

  strengths: StrengthItem[];
  gaps: GapItem[];

  skills: {
    technical: TechnicalSkill[];
    soft: SoftSkill[];
  };

  topRoles: TopRole[];
  achievements: Achievement[];
  resumeEdits: ResumeEdits;

  atsAndFormat: {
    isATSFriendly: boolean;
    recommendations: string[];
  };

  confidence: ConfidenceLevel;
  assumptions: string[];
}

export interface StrengthItem {
  text: string;
  why: string;
  confidence: ConfidenceLevel;
}

export interface GapItem {
  missing: string;
  impact: string;
  suggestedLearningOrAction: string;
  priority: "low" | "medium" | "high";
}

export interface TechnicalSkill {
  kind?: "technical"; // optional discriminator; safe if you later merge lists
  name: string;
  level: SkillLevel;
  evidenceLine: string;
}

export interface SoftSkill {
  kind?: "soft"; // optional discriminator
  name: string;
  evidenceLine: string;
}

export interface TopRole {
  title: string;
  why: string;
  fitScore: number; // 0..100
}

export interface Achievement {
  headline: string;
  metric: number | string | null; // null in your sample; keep flexible
  suggestedBullet: string;
}

export interface ResumeEdits {
  titleAndSummary: {
    headline: string;
    professionalSummary: string;
  };
  improvedBullets: Array<{
    old: string;
    new: string;
  }>;
}

export interface GetUserResumesResponse {
  status: "success" | "failed";
  count: number;
  items: ResumeRecord[];
  nextToken?: string | null;
}

/** ---------- Useful helpers (optional) ---------- */

/** Derive the raw userId from a PK like "USER#<uuid>" */
export function parseUserIdFromPK(pk: string): string | null {
  const i = pk.indexOf("#");
  return i >= 0 ? pk.slice(i + 1) : null;
}

export function normalizeContentType(contentType: string) {
  return contentType === "application/pdf"
    ? "PDF"
    : contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ? "DOCX"
    : "Unknown";
}
export function mapResumeData(resumes: ResumeRecord[]) {
  const normalizedResumes = resumes.map(
    (d) => (d.contentType = normalizeContentType(d.contentType))
  );
  return normalizedResumes;
}
/** Narrowers if you later store mixed skill arrays */
export const isTechnical = (
  s: TechnicalSkill | SoftSkill
): s is TechnicalSkill => (s as TechnicalSkill).level !== undefined;

export const isSoft = (s: TechnicalSkill | SoftSkill): s is SoftSkill =>
  (s as TechnicalSkill).level === undefined;
