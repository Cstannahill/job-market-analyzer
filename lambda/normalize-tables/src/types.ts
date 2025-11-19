/*  UTILITY TYPES  */
export type Nullable<T> = T | null | undefined;

/*  DYNAMO TYPES  */
export type DynamoStringAttribute = {
  S: string;
};

export type DynamoStringCollection = Array<string | DynamoStringAttribute>;

export type DynamoJobPosting = BaseJobListing & {
  benefits?: DynamoStringCollection;
  company_name?: string | null;
  company_size?: string | null;
  job_board_source?: string | null;
  source_url?: string | null;
  industry?: string | DynamoStringCollection | null;
  processed_day?: string | null;
  processed_week?: string | null;
  requirements?: DynamoStringCollection;
  salary_mentioned?: boolean | string | null;
  salary_range?: string | null;
  skills?: DynamoStringCollection;
  technologies?: DynamoStringCollection;
  years_exp_req?: string | null;
  normalized?: boolean | "true" | "false" | null;
  sources?: unknown;
  Id?: string;
  [key: string]: unknown;
};

/*  NEON ENUM TYPES  */
export type RemoteStatus = "hybrid" | "not_specified" | "on_site" | "remote";
export type CompanySize =
  | "startup"
  | "small"
  | "medium"
  | "large"
  | "enterprise";
export type JobSource = "greenhouse" | "lever" | "usajobs" | "muse" | "unknown";
export type SeniorityLevel = "junior" | "mid" | "senior" | "lead" | "executive";

/*  NEON TYPES  */

export type CompanyNeon = {
  id: string;
  name: string;
  size: CompanySize | null;
};

export type IndustryNeon = {
  id: string;
  name: string;
};

export type SkillNeon = {
  id: string;
  name: string;
};

export type TechnologyNeon = {
  id: string;
  name: string;
  type: string | null;
};

export type JobNeon = {
  id?: string;
  dynamoId: string;
  processedDate: string | null;
  companyName: string | null;
  jobDescription: string | null;
  jobTitle: string | null;
  location: string | null;
  remoteStatus: RemoteStatus | null;
  salaryMentioned: boolean | null;
  minimumSalary: number | null;
  maximumSalary: number | null;
  seniorityLevel: SeniorityLevel | null;
  status: string | null;
  source: JobSource | null;
  sourceUrl: string | null;
  yearsExpReq: string | null;
};

/*  NORMALIZER OUTPUT TYPES */
export type NewCompanyRecord = {
  name: string;
  size: CompanySize | null;
};

export type NewSkillRecord = {
  name: string;
};

export type NewIndustryRecord = {
  name: string;
};

export type NewTechnologyRecord = {
  name: string;
  type: string | null;
};

export type NormalizedJobEntities = {
  job: JobNeon;
  company: NewCompanyRecord | null;
  skills: NewSkillRecord[];
  technologies: NewTechnologyRecord[];
  industries: NewIndustryRecord[];
};
import type { BaseJobListing } from "@job-market-analyzer/types";
