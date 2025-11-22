import type {
  ResumeRecord,
  ResumeExperienceItem,
  ContactInfo,
  IsoDateString,
} from "@job-market-analyzer/types/resume-record";

export interface InsightsItem {
  resumeId: string;
  insightId: string;
  insightsText: unknown;
  generatedAt: IsoDateString;
  generatedBy: string;
}

export type Experience = Partial<ResumeExperienceItem>;

export type ResumeBaseItem = Pick<
  ResumeRecord,
  | "PK"
  | "SK"
  | "status"
  | "originalFileName"
  | "contentType"
  | "uploadInitiatedAt"
> & {
  s3Key: string;
  ttl: number;
};

export interface ResumeItem extends ResumeBaseItem {
  contactInfo: ContactInfo | Record<string, unknown>;
  totalExperienceMonths?: number;
  totalExperienceLabel?: string;
  skills: string[];
  education?: unknown[];
  experience: Experience[];
  uploadedAt: string;
  updatedAt?: string;
}

export interface ResumeWithInsights extends ResumeItem {
  insightId: string;
  insightsText: unknown;
  insightsMetadata: {
    generatedAt: IsoDateString;
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
  quote: string;
  char_start: number;
  char_end: number;
}

export interface TechnologyItem {
  canonical: string;
  aliases: string[];
  category: TechCategory;
  confidence: number;
  evidence: Evidence[];
  notes: string;
}

export interface SoftSkillItem {
  name: string;
  confidence: number;
  evidence: Evidence[];
  notes: string;
}

export interface StackCombination {
  name: string;
  components: string[];
  primary_use: string;
  evidence: Evidence[];
  rationale: string;
  confidence: number;
}

export interface Inferences {
  probable_roles: string[];
  seniority_signals: string[];
  domains: string[];
  evidence: Evidence[];
}

export interface SkillNormalizationResult {
  technologies: TechnologyItem[];
  soft_skills: SoftSkillItem[];
  stack_combinations: StackCombination[];
  inferences: Inferences;
  reasoning: string;
}
