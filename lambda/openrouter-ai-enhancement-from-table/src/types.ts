import type { BaseJobListing } from "@job-market-analyzer/types";

export interface JobRecord {
  jobId: string;
  company?: string;
  title?: string;
  description?: string;
  postedDate?: string;
  locationRaw?: string;
  sourcesRaw?: string;
  sourceUrl?: string;
  jobBoardSource?: string;
}

export interface EnrichedJobData
  extends Pick<
      BaseJobListing,
      | "jobId"
      | "job_title"
      | "job_description"
      | "technologies"
      | "skills"
      | "requirements"
      | "seniority_level"
      | "location"
      | "company_name"
      | "salary_mentioned"
      | "salary_range"
      | "remote_status"
      | "benefits"
      | "company_size"
      | "industry"
      | "processed_date"
      | "status"
      | "source_url"
      | "job_board_source"
    >,
    Partial<
      Pick<
        BaseJobListing,
        "salary_min" | "salary_max" | "salary_currency" | "requirements"
      >
    > {
  years_exp_req?: string;
  enrichment_run_id?: string;
}
