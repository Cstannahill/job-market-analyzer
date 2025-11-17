import axios from "axios";
import type { BaseJobListing } from "@/shared-types";

const API_URL = import.meta.env.VITE_API_URL || "";

export type NeonJobPageRequest = {
  page?: number;
  pageSize?: number;
  status?: string;
  tech?: string | null;
  remoteStatuses?: string[];
  seniorityLevels?: string[];
};

export type NeonJobPageResponse = {
  success: boolean;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  items: BaseJobListing[];
};

type NeonJobRecord = {
  id: string;
  dynamo_id?: string | null;
  job_title?: string | null;
  job_description?: string | null;
  company_name?: string | null;
  location?: string | null;
  remote_status?: string | null;
  seniority_level?: string | null;
  salary_mentioned?: boolean | null;
  minimum_salary?: number | null;
  maximum_salary?: number | null;
  status?: string | null;
  processed_date?: string | null;
  technologies?: string[] | null;
};

const DEFAULT_STATUS = "Active";

export async function getNeonJobPostingsPage(
  params: NeonJobPageRequest = {}
): Promise<NeonJobPageResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.status ?? DEFAULT_STATUS)
    searchParams.set("status", params.status ?? DEFAULT_STATUS);
  if (params.tech) searchParams.set("tech", params.tech);
  if (params.remoteStatuses?.length) {
    searchParams.set("remote_status", params.remoteStatuses.join(","));
  }
  if (params.seniorityLevels?.length) {
    searchParams.set("seniority_level", params.seniorityLevels.join(","));
  }

  const query = searchParams.toString();
  const url = `${API_URL}/job-postings-neon${query ? `?${query}` : ""}`;
  const response = await axios.get(url);
  const payload = unwrapLambdaPayload(response.data);

  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected response from Neon job postings endpoint");
  }

  const typed = payload as {
    success?: boolean;
    total?: number;
    totalPages?: number;
    page?: number;
    pageSize?: number;
    items?: NeonJobRecord[];
  };

  if (!typed.success) {
    throw new Error("Neon job postings endpoint returned an error");
  }

  const items = (typed.items ?? []).map(mapNeonRecordToJobPosting);

  return {
    success: true,
    total: typed.total ?? items.length,
    totalPages: typed.totalPages ?? 0,
    page: typed.page ?? 1,
    pageSize: typed.pageSize ?? items.length,
    items,
  };
}

function mapNeonRecordToJobPosting(record: NeonJobRecord): BaseJobListing {
  const technologies = (record.technologies ?? []).filter(Boolean) as string[];
  const salaryRange = formatSalaryRange(
    record.minimum_salary,
    record.maximum_salary
  );

  return {
    jobId: record.dynamo_id ?? record.id,
    benefits: [],
    company_name: record.company_name ?? "Unknown",
    company_size: "",
    industry: [],
    job_description: record.job_description ?? "",
    job_title: record.job_title ?? "",
    location: record.location ?? "",
    processed_date: record.processed_date ?? "",
    remote_status: normalizeRemoteStatus(record.remote_status),
    requirements: [],
    salary_mentioned: record.salary_mentioned ?? false,
    salary_range: salaryRange,
    seniority_level: record.seniority_level ?? "",
    skills: [],
    status: record.status ?? DEFAULT_STATUS,
    technologies,
  };
}

function unwrapLambdaPayload(payload: unknown): unknown {
  if (
    payload &&
    typeof payload === "object" &&
    "statusCode" in payload &&
    typeof (payload as { body?: unknown }).body === "string"
  ) {
    const proxyBody = (payload as { body?: unknown }).body;
    if (typeof proxyBody === "string") {
      try {
        return JSON.parse(proxyBody);
      } catch {
        return payload;
      }
    }
  }
  return payload;
}

function normalizeRemoteStatus(value?: string | null): string {
  if (!value) return "not_specified";
  const normalized = value.toLowerCase();
  if (normalized === "on_site") return "on_site";
  if (normalized === "remote") return "remote";
  if (normalized === "hybrid") return "hybrid";
  return normalized;
}

function formatSalaryRange(
  minimum?: number | null,
  maximum?: number | null
): string {
  const format = (value: number | null | undefined) =>
    typeof value === "number" ? Math.round(value).toString() : null;
  const minStr = format(minimum);
  const maxStr = format(maximum);

  if (minStr && maxStr) return `${minStr}-${maxStr}`;
  if (minStr) return `${minStr}+`;
  if (maxStr) return `<=${maxStr}`;
  return "";
}
