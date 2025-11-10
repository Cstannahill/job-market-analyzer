// skill-trends-v2.types.ts

/** Periods */
export type WeekPeriod = `${number}-W${number}`; // e.g. "2025-W44"
export type DayPeriod = `${number}-${string}-${string}`; // e.g. "2025-11-08"
export type Period = WeekPeriod | DayPeriod;

/** Dimensions */
export type WorkMode = "All" | "Remote" | "Hybrid" | "On-site";
export type Seniority =
  | "Unknown"
  | "Intern"
  | "Junior"
  | "Mid"
  | "Senior"
  | "Lead"
  | "Principal"
  | "Manager"
  | "Director";

/** Region codes */
export type CountryCode = "US" | "CA" | "GB" | string; // keep open for now
export type StateCode = "IL" | "CA" | "NY" | string; // keep open for now
export type Region = "GLOBAL" | CountryCode | `${CountryCode}-${StateCode}`;

/** Aggregation dimension flag carried by v2 items */
export type TrendDimension = "technology" | "skill" | "both";

/** Small maps used in trend rows */
export type CountMap = Record<string, number>;

/** Primary v2 trend row (DynamoDB: skill-trends-v2) */
export interface SkillTrendV2Item {
  /** PK: canonical technology/skill name */
  skill_canonical: string;

  /** SK: `${region}#${seniority}#${work_mode}#${period}` */
  region_seniority_mode_period: string;

  /** Convenience columns for indexes/queries */
  region: Region;
  seniority: Seniority;
  work_mode: WorkMode;
  period: Period;
  skill_display: string;

  /** “period#skill” and sort helper for TimeIndex */
  period_skill: string; // `${period}#${skill_canonical}`
  job_count_desc: string; // `${zeroPad(job_count)}#${skill}#${region}`

  /** Core metrics */
  job_count: number;

  /** Salary distribution (annual USD) */
  salary_min?: number;
  salary_max?: number;
  salary_median?: number; // p50
  salary_p75?: number;
  salary_p95?: number;

  /** Shares (fractions 0..1) */
  regional_share?: number; // tech_count / total_postings_in_region_period
  global_share?: number; // tech_count / total_postings_global_period
  remote_share?: number; // (remote postings for this tech tuple) / job_count

  /** Context signals */
  cooccurring_skills?: CountMap; // top co-techs or skills
  industry_distribution?: CountMap; // top industries
  top_titles?: CountMap; // top role titles

  /** Momentum (optional if previous period missing) */
  job_count_change_pct?: number; // Δ vs prev period
  median_salary_change_pct?: number; // Δ vs prev period
  trend_signal?: "rising" | "falling" | "steady";

  /** Which dimension this row represents */
  dimension?: TrendDimension; // default "technology"
}

/** Totals row (DynamoDB: job-postings-totals) */
export interface JobPostingsTotals {
  period: Period;
  region: Region;
  job_count: number; // total postings in region for period (denominator)
}

/* ===========================
   V2 API response contracts
   =========================== */

/** Common wrapper for list endpoints */
export interface V2ListResponse<T> {
  region: Region;
  period: Period;
  count: number;
  data: T[];
}

/** /v2/trends/technologies/top */
export type TopTechnologiesItem = Pick<
  SkillTrendV2Item,
  | "skill_canonical"
  | "skill_display"
  | "region"
  | "work_mode"
  | "period"
  | "job_count"
  | "regional_share"
  | "global_share"
  | "salary_median"
  | "salary_p75"
  | "salary_p95"
  | "trend_signal"
  | "remote_share"
  | "job_count_change_pct"
  | "cooccurring_skills"
  | "industry_distribution"
  | "top_titles"
>;
export type GetTopTechnologiesResponse = V2ListResponse<TopTechnologiesItem>;

/** /v2/trends/technologies/rising */
export type RisingTechnologiesItem = TopTechnologiesItem; // same fields, sorted by change pct
export type GetRisingTechnologiesResponse =
  V2ListResponse<RisingTechnologiesItem>;

/** /v2/trends/technology/{name} */
export interface TechnologyDetailResponse {
  technology: string;
  region: Region;
  period: Period;

  /** All-mode summary row if available (most dashboards use this) */
  summary: SkillTrendV2Item | null;

  /** Work-mode slices for the same tech/region/period */
  by_work_mode: Array<{
    work_mode: WorkMode;
    job_count: number;
    salary_median?: number;
    seniority: string;
    regional_share?: number;
    global_share?: number;
  }>;

  /** Seniority slices aggregated client-side or pre-aggregated */
  by_seniority: Array<{
    level: Seniority;
    job_count: number;
    salary_median?: number;
  }>;

  /** Context maps */
  cooccurring_skills?: CountMap;
  industry_distribution?: CountMap;
  top_titles?: CountMap;
}

/** /v2/trends/overview */
export interface TrendsOverviewResponse {
  region: Region;
  period: Period;
  total_postings: number;
  remote_share?: number;
  top_technologies: TopTechnologiesItem[];
}

/* ===========================
   Request query helpers
   =========================== */

export interface TopQuery {
  region: Region; // e.g. "US", "US-IL", "GLOBAL"
  period: Period; // "2025-W44" or "2025-11-08"
  limit?: number; // default 20
}

export type RisingQuery = TopQuery;

export interface TechnologyDetailQuery {
  name: string; // canonical or display tech name
  region: Region;
  period: Period;
}

export interface OverviewQuery {
  region: Region;
  period: Period;
  limit?: number; // top technologies included in overview
}
