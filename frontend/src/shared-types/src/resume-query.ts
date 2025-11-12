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
  durationMonths: number;
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
  overallImpression?: string;
};
/** ---------- Insights tree ---------- */

export interface ResumeInsights {
  summary: Summary;
  salaryInsights?: SalaryInsights;
  skillStacks?: SkillStacks;
  marketAlignment?: MarketAlignment;
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
interface SalaryInsights {
  currentEstimate: {
    range: {
      min: number;
      median: number;
      p75: number;
      p95: number;
    };
    level: "junior" | "mid" | "senior" | "lead";
    reasoning: string;
  };
  potentialGrowth: Array<{
    targetLevel: "senior" | "lead";
    estimatedSalary: {
      median: number;
      p75: number;
    };
    requiresSkills: string[];
    timeframe: string;
  }>;
  skillROI: Array<{
    skill: string;
    currentAvgSalary: number;
    withSkillAvgSalary: number;
    increase: number;
    increasePercentage: number;
    reasoning: string;
  }>;
}

interface SkillStacks {
  currentStack: {
    skills: string[];
    commonPairings: Array<{
      skill: string;
      appearsTogetherPercentage: number;
    }>;
    completeness: number;
  };
  recommendedStacks: Array<{
    name: string;
    description: string;
    addSkills: string[];
    projectedFit: number;
    salaryRange: {
      median: number;
      p75: number;
    };
  }>;
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

export interface PotentialGrowth {
  targetLevel: "senior" | "lead";
  estimatedSalary: {
    median: number;
    p75: number;
  };
  timeframe: string;
  requiresSkills: Array<{
    skill: string;
    timeToLearn: string;
    priority: number;
  }>;
  learningPath: string; // NEW: Sequential learning plan
  reasoning: string;
}

export interface RecommendedStack {
  name: string;
  description: string;
  currentSkills: string[];
  addSkills: Array<{
    skill: string;
    timeToLearn: string;
    demand: number;
    priority: number;
  }>;
  totalLearningTime: string; // NEW
  jobCount: number; // NEW
  salaryRange: {
    median: number;
    p75: number;
  };
  commonRoles: string[]; // NEW
  projectedFit: number;
}

export interface TopRole {
  title: string;
  level: string; // NEW: "Junior", "Mid", "Senior", "Lead"
  why: string;
  fitScore: number;
  salaryRange: {
    // NEW
    median: number;
    p75: number;
  };
  jobCount: number; // NEW
  requiredSkills: string[]; // NEW
  niceToHave: string[]; // NEW
}

interface MarketAlignment {
  matchedSkills: Array<{
    skill: string;
    demand: number;
    onResume: true;
    percentile: number;
  }>;
  missingHighDemandSkills: Array<{
    skill: string;
    demand: number;
    priority: "high" | "medium" | "low";
    reason: string;
    learningPath: string;
  }>;
  demandScore: number;
  demandScoreExplanation: string;
}
/** ---------- Useful helpers (optional) ---------- */

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
