import axios from "axios";

// Replace this with your actual API Gateway URL
const API_URL = import.meta.env.VITE_API_URL || "";
import type { BaseJobListing } from "@job-market-analyzer/types";

// Extended model for new table fields

export interface ApiResponse {
  success: boolean;
  count: number;
  data: BaseJobListing[];
}

/**
 * Fetch all job postings from the API
 */
const parseSalaryRange = (s: string | undefined | null) => {
  if (!s) return { min: null, max: null, currency: null };
  const trimmed = String(s).trim();
  // Try to detect currency symbol (USD $, £, €, etc.) or trailing currency code
  const currencyMatch =
    trimmed.match(/\b([A-Z]{3})\b/) || trimmed.match(/(\$|£|€|¥)/);
  const currency = currencyMatch ? currencyMatch[0] : null;

  // Find numbers with optional commas and decimals
  const nums = Array.from(
    trimmed.matchAll(/([0-9]{1,3}(?:[,\d]*)(?:\.\d)?)/g)
  ).map((m) => m[0].replace(/,/g, ""));
  const parsed = nums.map((n) => Number(n)).filter((n) => !isNaN(n));
  if (parsed.length === 0) return { min: null, max: null, currency };
  if (parsed.length === 1) return { min: parsed[0], max: parsed[0], currency };
  // assume first two are min/max
  return {
    min: Math.min(parsed[0], parsed[1]),
    max: Math.max(parsed[0], parsed[1]),
    currency,
  };
};

type RawJobRow = Record<string, unknown>;

const normalizeArray = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map((x) => String(x));
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((p: unknown) => {
              if (
                p &&
                typeof p === "object" &&
                "S" in (p as Record<string, unknown>)
              ) {
                return (p as Record<string, unknown>)["S"];
              }
              return p;
            })
            .flat()
            .filter(Boolean)
            .map((x) => String(x));
        }
        if (typeof parsed === "object") return Object.values(parsed).map(String);
      } catch {
        // not JSON, fallthrough
      }
    }
    const splitOn = [",", "|", ";"].find((token) => trimmed.includes(token));
    if (splitOn) {
      return trimmed
        .split(splitOn)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return trimmed ? [trimmed] : [];
  }
  return [String(v)];
};

const coerceString = (value: unknown, fallback = ""): string => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str || fallback;
};

const coerceOptionalString = (value: unknown): string | undefined => {
  const str = coerceString(value);
  return str ? str : undefined;
};

const coerceBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

const toBaseJobListing = (raw: RawJobRow): BaseJobListing => {
  const jobId =
    coerceString(
      raw.jobId ??
        raw.Id ??
        raw.id ??
        raw.pk ??
        raw.PK ??
        raw.JobId ??
        raw.resume_id ??
        ""
    ) || "unknown-job";
  const job_title =
    coerceString(raw.job_title ?? raw.title ?? raw.jobTitle ?? "Unknown role") ||
    "Unknown role";
  const job_description = coerceString(
    raw.job_description ?? raw.description ?? ""
  );
  const location = coerceString(
    raw.location ?? raw.job_location ?? raw.location_raw ?? "Unknown"
  );
  const processed_date =
    coerceString(
      raw.processed_date ??
        raw.date ??
        raw.processedDate ??
        raw.posted_date ??
        raw.created_at ??
        ""
    ) || new Date().toISOString();
  const remote_status = coerceString(
    raw.remote_status ?? raw.remote ?? raw.workMode ?? "unknown"
  );

  const salaryRangeSource =
    (typeof raw.salary_range === "string" && raw.salary_range) ||
    (typeof raw.salary === "string" && raw.salary) ||
    (typeof raw.salaryRange === "string" && raw.salaryRange) ||
    undefined;
  const { min, max, currency } = parseSalaryRange(salaryRangeSource);
  const salary_min =
    typeof raw.minimum_salary === "number" ? raw.minimum_salary : min;
  const salary_max =
    typeof raw.maximum_salary === "number" ? raw.maximum_salary : max;
  const salary_currency =
    (typeof raw.salary_currency === "string" && raw.salary_currency) ||
    currency;

  const benefits = normalizeArray(
    raw.benefits ?? raw.benefit_list ?? raw.benefits_parsed
  );
  const industry = normalizeArray(
    raw.industry ?? raw.industries ?? raw.industry_list
  );
  const requirements = normalizeArray(
    raw.requirements ??
      raw.requirement_list ??
      raw.requirements_parsed ??
      raw.requirement
  );
  const skills = normalizeArray(
    raw.skills ??
      raw.skill_list ??
      raw.Skills ??
      raw.skills_parsed ??
      raw.requirements
  );
  const technologies = normalizeArray(
    raw.technologies ??
      raw.tech ??
      raw.technologies_parsed ??
      raw.technologies_list ??
      raw.technologies_raw ??
      raw.technologies_normalized
  );

  return {
    jobId,
    job_title,
    job_description,
    location,
    processed_date,
    remote_status,
    company_name: coerceOptionalString(
      raw.company_name ??
        raw.company ??
        raw.employer ??
        raw.employer_name ??
        raw.companyName
    ),
    company_size: coerceOptionalString(raw.company_size ?? raw.companySize),
    industry: industry.length ? industry : undefined,
    benefits: benefits.length ? benefits : undefined,
    requirements: requirements.length ? requirements : undefined,
    salary_mentioned:
      coerceBoolean(raw.salary_mentioned ?? raw.salaryMentioned) ?? undefined,
    salary_range: salaryRangeSource,
    salary_min,
    salary_max,
    salary_currency: salary_currency ?? undefined,
    seniority_level: coerceOptionalString(
      raw.seniority_level ?? raw.seniority
    ),
    skills: skills.length ? skills : undefined,
    status: coerceOptionalString(raw.status),
    technologies: technologies.length ? technologies : undefined,
    source_url: coerceOptionalString(raw.source_url ?? raw.url),
    job_board_source: coerceOptionalString(
      raw.job_board_source ?? raw.jobBoardSource
    ),
  };
};

export const getJobPostings = async (): Promise<BaseJobListing[]> => {
  try {
    const response = await axios.get(`${API_URL}/job-postings`);

    let payload = response.data;

    // Lambda proxy-style responses sometimes come wrapped with statusCode/body
    if (typeof payload === "object" && payload !== null) {
      const proxy = payload as Record<string, unknown>;
      if ("statusCode" in proxy && typeof proxy.body === "string") {
        try {
          payload = JSON.parse(proxy.body as string);
        } catch {
          // fall through and handle as-is
        }
      }
    }

    // New table-backed API may return rows in a `items` or `data` array, or raw array
    const pObj =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const rows: unknown[] =
      Array.isArray(pObj.items) && (pObj.items as unknown[]).length
        ? (pObj.items as unknown[])
        : Array.isArray(pObj.data) && (pObj.data as unknown[]).length
        ? (pObj.data as unknown[])
        : Array.isArray(payload)
        ? (payload as unknown[])
        : [];

    const mapped: BaseJobListing[] = rows
      .map((row) =>
        row && typeof row === "object"
          ? toBaseJobListing(row as RawJobRow)
          : null
      )
      .filter((row): row is BaseJobListing => row !== null);

    return mapped;
  } catch (error) {
    console.error("Full error:", error);
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch job postings"
      );
    }
    throw error;
  }
};

/**
 * Fetch a single page of job postings from the API using server-side pagination.
 * Returns items, count, and a lastKey token (base64) to fetch the next page.
 */
export const getJobPostingsPage = async (opts?: {
  limit?: number;
  lastKey?: string | null;
  tech?: string;
  workModes?: string[];
  seniorityLevels?: string[];
}): Promise<{
  items: BaseJobListing[];
  count: number;
  lastKey?: string | null;
}> => {
  const params: Record<string, string> = {};
  if (opts?.limit) params.limit = String(opts.limit);
  if (opts?.lastKey) params.lastKey = opts.lastKey;
  if (opts?.tech) params.tech = opts.tech;
  if (opts?.workModes?.length)
    params["remote_status"] = opts.workModes.join(",");
  if (opts?.seniorityLevels?.length)
    params["seniority_level"] = opts.seniorityLevels.join(",");

  const q = new URLSearchParams(params).toString();
  const url = `${API_URL}/job-postings${q ? `?${q}` : ""}`;
  const response = await axios.get(url);
  let payload = response.data;

  if (typeof payload === "object" && payload !== null) {
    const proxy = payload as Record<string, unknown>;
    if ("statusCode" in proxy && typeof proxy.body === "string") {
      try {
        payload = JSON.parse(proxy.body as string);
      } catch (e) {
        // ignore parse errors and use raw body
        console.warn("Failed to parse proxy body as JSON", e);
      }
    }
  }

  const p = (payload as Record<string, unknown>) || {};
  const itemsRaw = Array.isArray(p.data)
    ? p.data
    : Array.isArray(p.items)
    ? p.items
    : [];

  const items: BaseJobListing[] = (itemsRaw as unknown[])
    .map((row) =>
      row && typeof row === "object"
        ? toBaseJobListing(row as RawJobRow)
        : null
    )
    .filter((row): row is BaseJobListing => row !== null);

  const lastKey = (p.lastKey as string) ?? null;
  const count = typeof p.count === "number" ? p.count : items.length;
  return { items, count, lastKey };
};
