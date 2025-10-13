/**
 * A normalized representation of a job posting used across the frontend and
 * backend packages. Fields are produced by normalization adapters and are
 * expected to exist (possibly empty) for each job listing.
 */
export interface BaseJobListing {
  /** Unique identifier for the job (DynamoDB PK, database id, or generated UUID) */
  jobId: string;
  /** Parsed list of benefits mentioned on the posting (e.g. 'Health insurance') */
  benefits: string[];
  /** Normalized company name */
  company_name: string;
  /** Normalized company size string (if available) */
  company_size: string;
  /** Array of industry identifiers or names */
  industry: string[];
  /** Full job description / body text */
  job_description: string;
  /** Job title (normalized) */
  job_title: string;
  /** Location string (city, remote, etc.) */
  location: string;
  /** ISO date string when this item was processed */
  processed_date: string;
  /** Remote status such as 'remote', 'hybrid', 'onsite' */
  remote_status: string;
  /** Normalized requirement/skill lines */
  requirements: string[];
  /** Whether a salary is mentioned in the posting */
  salary_mentioned: boolean;
  /** Raw parsed salary range string (unstructured) */
  salary_range: string;
  /** Seniority level if provided (e.g. 'Senior', 'Mid') */
  seniority_level: string;
  /** Normalized skill tokens */
  skills: string[];
  /** Posting lifecycle/status string (optional field used internally) */
  status: string;
  /** Normalized technology tokens */
  technologies: string[];
}

/**
 * Count item for a requirement (skill/requirement) used in aggregated stats.
 * - id: canonical identifier (often the name or a normalized key)
 * - name: optional human-friendly name
 * - createdAt: optional timestamp when the stat was created
 * - count: number of occurrences across postings
 */
export type JobRequirementsStatItem = {
  id: string;
  name?: string;
  createdAt?: string;
  count: number;
};

/**
 * Aggregation item for a technology (e.g. 'React', 'Node.js')
 */
export type TechnologyStatItem = {
  id: string;
  name?: string;
  createdAt?: string;
  count: number;
};

/**
 * Aggregation item for a skill
 */
export type SkillStatItem = {
  id: string;
  name?: string;
  createdAt?: string;
  count: number;
};

/**
 * Aggregation item for an industry
 */
export type IndustryStatItem = {
  id: string;
  name?: string;
  createdAt?: string;
  count: number;
};

/**
 * Aggregation item for a benefit (e.g. '401k', 'Paid time off')
 */
export type BenefitStatItem = {
  id: string;
  name?: string;
  createdAt?: string;
  count: number;
};

/**
 * Aggregated statistics derived from job postings.
 * - skills: list of top skills with counts
 * - technologies: optional list of top technologies with counts
 * - totals: numeric summary fields
 */
export type JobStats = {
  /** Top skills and their counts */
  skills: SkillStatItem[];
  /** Top technologies and their counts (optional) */
  technologies?: TechnologyStatItem[];
  /** Number of distinct requirement types (optional) */
  requirementsCounts?: number;
  /** Number of distinct industries (optional) */
  industriesCounts?: number;
  /** Number of distinct benefits (optional) */
  benefitCounts?: number;
  /** Total postings covered by these stats */
  totalPostings: number;
  /** Total distinct skill types */
  totalSkills: number;
  /** Total distinct technology types */
  totalTechnologies: number;
  /** ISO timestamp when these stats were last updated */
  updatedAt: string;
};
