/**
 * Normalized job posting contract shared by the frontend and Lambda
 * functions. Every field coming from untyped sources should be coerced
 * into this structure before it is consumed.
 */
export interface BaseJobListing {
  /** Primary identifier (Dynamo PK, UUID, etc.) */
  jobId: string;
  /** Normalized job title */
  job_title: string;
  /** Raw/normalized job description text */
  job_description: string;
  /** Location text �?" can be "remote" */
  location: string;
  /** ISO date string for when this posting was processed */
  processed_date: string;
  /** Remote/hybrid/onsite classification */
  remote_status: string;

  /**
   * Ancillary metadata gathered from various sources. These fields are
   * optional because upstream datasets frequently omit them.
   */
  company_name?: string;
  company_size?: string;
  industry?: string[];
  requirements?: string[];
  salary_mentioned?: boolean;
  salary_range?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  seniority_level?: string;
  skills?: string[];
  status?: string;
  technologies?: string[];
  benefits?: string[];
  source_url?: string;
  job_board_source?: string;
}

/**
 * Generic helper used by multiple stats tables. DynamoDB items sometimes
 * arrive with extra metadata so the ids/names are intentionally loose.
 */
export type CountStatItem = {
  id: string;
  name?: string;
  createdAt?: string;
  count: number;
};

export type JobRequirementsStatItem = CountStatItem;
export type TechnologyStatItem = CountStatItem;
export type SkillStatItem = CountStatItem;
export type IndustryStatItem = CountStatItem;
export type BenefitStatItem = CountStatItem;

/**
 * Aggregated statistics derived from job postings.
 */
export type JobStats = {
  skills: SkillStatItem[];
  technologies?: TechnologyStatItem[];
  requirementsCounts?: number;
  industriesCounts?: number;
  benefitCounts?: number;
  totalPostings: number;
  totalSkills: number;
  totalTechnologies: number;
  updatedAt: string;
  [custom: string]: unknown;
};
