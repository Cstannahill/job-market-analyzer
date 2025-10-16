import axios from "axios";

// Replace this with your actual API Gateway URL
const API_URL = import.meta.env.VITE_API_URL || "";
import type { BaseJobListing } from "@/shared-types";

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

    // Map backend row shape to frontend JobPosting
    const normalizeArray = (v: unknown): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter(Boolean).map((x) => String(x));
      if (typeof v === "string") {
        // Attempt to parse JSON-like strings: '[]' or '[{"S":"val"}]' or '"a,b"' or 'a, b'
        const trimmed = v.trim();
        // JSON array
        if (
          (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
          (trimmed.startsWith("{") && trimmed.endsWith("}"))
        ) {
          try {
            const parsed = JSON.parse(trimmed);
            // If parsed is array of objects with S keys (AWS style), extract S
            if (Array.isArray(parsed)) {
              return parsed
                .map((p: unknown) => {
                  if (
                    p &&
                    typeof p === "object" &&
                    "S" in (p as Record<string, unknown>)
                  )
                    return (p as Record<string, unknown>)["S"];
                  return p;
                })
                .flat()
                .filter(Boolean)
                .map((x) => String(x));
            }
            if (typeof parsed === "object")
              return Object.values(parsed).map(String);
          } catch {
            // not JSON, fallthrough
          }
        }
        // comma separated
        if (trimmed.includes(","))
          return trimmed
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        // pipe or semicolon separated
        if (trimmed.includes("|"))
          return trimmed
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);
        if (trimmed.includes(";"))
          return trimmed
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean);
        // single value
        return [trimmed];
      }
      // fallback
      return [String(v)];
    };

    const mapped: BaseJobListing[] = rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      // Support a few common field names from the new table
      const id =
        (r.jobId as string) ||
        (r.Id as string) ||
        (r.id as string) ||
        (r.pk as string) ||
        (r.PK as string) ||
        (r.JobId as string) ||
        "";
      const title =
        (r.title as string) ||
        (r.job_title as string) ||
        (r.jobTitle as string) ||
        "";
      const location =
        (r.location as string) ||
        (r.job_location as string) ||
        (r.location_raw as string) ||
        "";

      const date =
        (r.posted_date as string) ||
        (r.postedAt as string) ||
        (r.date as string) ||
        (r.processed_date as string) ||
        (r.created_at as string) ||
        "";

      const benefits = normalizeArray(
        r.benefits ?? r.benefit_list ?? r.benefits_parsed
      );
      const company_size =
        (r.company_size as string) || (r.companySize as string) || undefined;
      // Try to extract a company/employer name from common fields
      const company_name =
        (r.company as string) ||
        (r.company_name as string) ||
        (r.employer as string) ||
        (r.employer_name as string) ||
        (r.companyName as string) ||
        undefined;
      const industry = (r.industry as string) || undefined;
      const processed_date = (r.processed_date as string) || undefined;
      const remote_status =
        (r.remote_status as string) || (r.remote as string) || undefined;
      const requirements = normalizeArray(
        r.requirements ??
          r.requirement_list ??
          r.requirements_parsed ??
          r.requirement
      );
      const salary_mentioned =
        (r.salary_mentioned as boolean) ??
        (r.salaryMentioned as boolean) ??
        false;
      const salary_range =
        (r.salary_range as string) || (r.salary as string) || undefined;
      const seniority_level = (r.seniority_level as string) || undefined;

      const {
        min: salary_min,
        max: salary_max,
        currency: salary_currency,
      } = parseSalaryRange(salary_range);

      const skills = normalizeArray(
        r.skills ??
          r.requirements ??
          r.skill_list ??
          r.Skills ??
          r.skills_parsed
      );
      const technologies = normalizeArray(
        r.technologies ??
          r.tech ??
          r.technologies_parsed ??
          r.technologies_list ??
          r.technologies_raw ??
          r.technologies_normalized
      );
      return {
        jobId: String(id),
        job_title: String(title),
        location: String(location),
        job_description: r.job_description ? String(r.job_description) : "",
        company_name: String(company_name),
        skills,
        technologies,
        date: String(date),
        benefits,
        company_size,
        industry,
        processed_date,
        remote_status,
        requirements,
        salary_mentioned,
        salary_range,
        salary_min,
        salary_max,
        salary_currency,
        seniority_level,
      } as unknown as BaseJobListing;
    });

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
}): Promise<{
  items: BaseJobListing[];
  count: number;
  lastKey?: string | null;
}> => {
  const params: Record<string, string> = {};
  if (opts?.limit) params.limit = String(opts.limit);
  if (opts?.lastKey) params.lastKey = opts.lastKey;

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

  const items: BaseJobListing[] = (itemsRaw as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      jobId: String(row["Id"] ?? row["id"] ?? row["jobId"] ?? ""),
      job_title: String(row["title"] ?? row["job_title"] ?? ""),
      job_description: String(
        row["job_description"] ?? row["description"] ?? ""
      ),
      location: String(row["location"] ?? row["job_location"] ?? ""),
      skills: Array.isArray(row["skills"]) ? (row["skills"] as string[]) : [],
      technologies: Array.isArray(row["technologies"])
        ? (row["technologies"] as string[])
        : [],
      processed_date: String(row["date"] ?? row["processed_date"] ?? ""),
      company_name: String(row["company_name"] ?? "Unknown"),
      industry: String(row["industry"] ?? "Unknown"),
      remote_status: String(row["remote_status"] ?? "Unknown"),
      seniority_level: String(row["seniority_level"] ?? "Unknown"),
    } as unknown as BaseJobListing;
  });

  const lastKey = (p.lastKey as string) ?? null;
  const count = typeof p.count === "number" ? p.count : items.length;
  return { items, count, lastKey };
};
