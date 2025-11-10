// lambdas/aggregate-skill-trends-v2/types.ts
export type Period = `${number}-W${number}` | `${number}-${string}-${string}`;

export type WorkMode = "On-site" | "Hybrid" | "Remote" | "All";
export type Seniority =
  | "Intern"
  | "Junior"
  | "Mid"
  | "Senior"
  | "Lead"
  | "Principal"
  | "Manager"
  | "Director"
  | "Unknown"
  | "All";
export type Event = { forcePeriod?: string; granularity?: "weekly" | "daily" };
export interface TrendItem {
  skill_canonical: string; // PK
  region_seniority_mode_period: string; // SK  "US-IL#Senior#All#2025-W45"
  skill_display?: string;
  // duplicates for GSIs / projection
  region: string; // "GLOBAL" | "US" | "US-IL" | "GB" ...
  seniority: Seniority;
  work_mode: WorkMode;
  period: Period;

  // helpers for GSIs
  period_skill: string; // "2025-W45#React"
  job_count_desc: string; // zero-padded count desc: "0000120#React#US-IL"
  dimension?: "technology" | "skill" | "both";
  // metrics
  job_count: number;
  salary_min?: number;
  salary_max?: number;
  salary_median?: number;
  salary_p75?: number;
  salary_p95?: number;

  remote_share?: number; // only on work_mode=All rows
  regional_share?: number; // share of all postings in region/period
  global_share?: number; // share of all postings global/period

  job_count_change_pct?: number;
  median_salary_change_pct?: number;
  trend_signal?: "rising" | "falling" | "steady";

  cooccurring_skills?: Record<string, number>; // top N
  industry_distribution?: Record<string, number>;
  top_titles?: Record<string, number>;

  skill_aliases?: string[]; // optional trace
}
