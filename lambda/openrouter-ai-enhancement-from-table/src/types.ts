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

export interface EnrichedJobData {
  jobId: string;
  job_title: string | undefined;
  job_description: string | undefined;
  technologies: string[];
  skills: string[];
  requirements: string[];
  years_exp_req?: string;
  seniority_level?: string;
  location?: string;
  company_name?: string;
  salary_mentioned: boolean;
  salary_range?: string;
  remote_status: string | undefined;
  benefits: string[];
  company_size?: string;
  industry?: string;
  processed_date: string;
  status?: string;
  enrichment_run_id?: string;
  source_url?: string;
  job_board_source?: string;
}
