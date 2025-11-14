export interface InsightsItem {
  resumeId: string;
  insightId: string;
  insightsText: any;
  generatedAt: string;
  generatedBy: string;
}

export interface Experience {
  title?: string;
  company?: string;
  location?: string;
  duration?: string;
  description?: string[];
}

export interface ResumeBaseItem {
  PK: string; //userId
  SK: string; //resumeId
  status: "pending" | "processed" | "failed";
  originalFileName: string;
  s3Key: string;
  contentType: string;
  uploadInitiatedAt: string;
  ttl: number;
}

export interface ResumeItem extends ResumeBaseItem {
  contactInfo: Record<string, any>;
  totalExperienceMonths?: number;
  totalExperienceLabel?: string;
  skills: string[];
  education?: any[];
  experience: Experience[];
  uploadedAt: string;
  updatedAt?: string;
}

export interface ResumeWithInsights extends ResumeItem {
  insightId: string;
  insightsText: any;
  insightsMetadata: {
    generatedAt: string;
    generatedBy: string;
  };
}

export interface Extractor {
  kind: "textract" | "ocr-fastapi";
  extract(input: { s3Key?: string; bytes?: Uint8Array }): Promise<{
    text: string;
    confidence?: number;
    blocks?: any[];
    costEstimateUSD?: number;
  }>;
}

export type TechRow = {
  Id?: string;
  postingCount?: number;
};
export type SkillCount = { technology: string; demand: number };

export type SeniorityData = Array<{
  level: string;
  job_count: number;
  salary_median: number;
}>;
export interface EnrichedSkillData {
  technology: string;
  job_count: number;
  salary_median: number;
  salary_min: number;
  salary_p75: number;
  salary_p95: number;
  cooccurring_skills: Record<string, number>;
  industry_distribution: Record<string, number>;
  top_titles: Record<string, number>;
  by_seniority: SeniorityData;
}

// SKILL NORMALIZATION AND HELPERS
// Literal unions for consistency
export type TechCategory =
  | "language"
  | "framework"
  | "runtime"
  | "database"
  | "cloud"
  | "devops"
  | "tooling"
  | "testing"
  | "data"
  | "other";

export interface Evidence {
  quote: string; // ≤160 chars from resume
  char_start: number; // index into provided resume slice
  char_end: number; // index into provided resume slice
}

export interface TechnologyItem {
  canonical: string; // e.g., "TypeScript"
  aliases: string[]; // e.g., ["TS"]
  category: TechCategory;
  confidence: number; // 0.0–1.0
  evidence: Evidence[]; // >=1
  notes: string; // brief rationale; can be ""
}

export interface SoftSkillItem {
  name: string; // e.g., "cross-functional collaboration"
  confidence: number; // 0.0–1.0
  evidence: Evidence[]; // >=1
  notes: string; // brief rationale; can be ""
}

export interface StackCombination {
  name: string; // e.g., "React + TypeScript + AWS"
  components: string[]; // canonical technology names
  primary_use: string; // e.g., "full-stack web app"
  evidence: Evidence[]; // >=1
  rationale: string; // why inferred (grounded)
  confidence: number; // 0.0–1.0
}

export interface Inferences {
  probable_roles: string[]; // e.g., ["Full-Stack Engineer"]
  seniority_signals: string[]; // e.g., ["led team", "on-call"]
  domains: string[]; // e.g., ["fintech", "healthtech"]
  evidence: Evidence[]; // >=1
}

export interface SkillNormalizationResult {
  technologies: TechnologyItem[];
  soft_skills: SoftSkillItem[];
  stack_combinations: StackCombination[];
  inferences: Inferences;
  reasoning: string; // brief explanation of tricky normalizations / uncertainties
}
