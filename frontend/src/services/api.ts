import axios from "axios";

// Replace this with your actual API Gateway URL
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod";

export interface JobPosting {
  Id: string;
  title: string;
  skills: string[];
  technologies: string[];
  raw_text: string;
  date: string;
  source_file: string;
}

// Extended model for new table fields
export interface ExtendedJobPosting extends JobPosting {
  benefits?: string[];
  company_size?: string;
  company?: string;
  industry?: string;
  processed_date?: string;
  remote_status?: string;
  requirements?: string[];
  salary_mentioned?: boolean;
  salary_range?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  seniority_level?: string;
}

export interface ApiResponse {
  success: boolean;
  count: number;
  data: JobPosting[];
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
    trimmed.matchAll(/([0-9]{1,3}(?:[,\d]*)(?:\.\d+)?)/g)
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

export const getJobPostings = async (): Promise<ExtendedJobPosting[]> => {
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

    const mapped: ExtendedJobPosting[] = rows.map((row: unknown) => {
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
      const raw_text =
        (r.raw_text as string) ||
        (r.description as string) ||
        (r.job_description as string) ||
        (r.body as string) ||
        "";
      const date =
        (r.posted_date as string) ||
        (r.postedAt as string) ||
        (r.date as string) ||
        (r.processed_date as string) ||
        (r.created_at as string) ||
        "";
      const source_file =
        (r.source as string) ||
        (r.source_file as string) ||
        (r.filename as string) ||
        "";

      const benefits = normalizeArray(
        r.benefits ?? r.benefit_list ?? r.benefits_parsed
      );
      const company_size =
        (r.company_size as string) || (r.companySize as string) || undefined;
      // Try to extract a company/employer name from common fields
      const company =
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
        Id: String(id),
        title: title,
        company,
        skills,
        technologies,
        raw_text: raw_text,
        date: String(date),
        source_file: source_file,
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
      } as ExtendedJobPosting;
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
  items: ExtendedJobPosting[];
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

  const items: ExtendedJobPosting[] = (itemsRaw as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      Id: String(row["Id"] ?? row["id"] ?? row["jobId"] ?? ""),
      title: String(row["title"] ?? row["job_title"] ?? ""),
      skills: Array.isArray(row["skills"]) ? (row["skills"] as string[]) : [],
      technologies: Array.isArray(row["technologies"])
        ? (row["technologies"] as string[])
        : [],
      raw_text: String(row["raw_text"] ?? row["description"] ?? ""),
      date: String(row["date"] ?? row["processed_date"] ?? ""),
      source_file: String(row["source_file"] ?? row["source"] ?? ""),
      company: String(row["company_name"] ?? "Unknown"),
      location: String(row["location"] ?? "Unknown"),
      industry: String(row["industry"] ?? "Unknown"),
      seniority_level: String(row["seniority_level"] ?? "Unknown"),
    } as ExtendedJobPosting;
  });

  const lastKey = (p.lastKey as string) ?? null;
  const count = typeof p.count === "number" ? p.count : items.length;
  return { items, count, lastKey };
};

/**
 * Fetch aggregated job postings stats (counts) from the API
 */
export const getJobPostingsStats = async (): Promise<{
  totalPostings: number;
  totalTechnologies: number;
  totalSkills: number;
  technologyCounts: Record<string, number>;
  skillCounts?: Record<string, number>;
  items?: ExtendedJobPosting[];
}> => {
  try {
    const response = await axios.get(`${API_URL}/job-stats`);

    let payload = response.data;

    // Unwrap Lambda proxy responses (statusCode/body)
    if (typeof payload === "object" && payload !== null) {
      const proxy = payload as Record<string, unknown>;
      if ("statusCode" in proxy && typeof proxy.body === "string") {
        try {
          payload = JSON.parse(proxy.body as string);
        } catch {
          // fall through
        }
      }
    }

    // Some lambdas return { success: true, data: "<json string>" }
    if (
      payload &&
      typeof payload === "object" &&
      typeof (payload as Record<string, unknown>).data === "string"
    ) {
      try {
        payload = JSON.parse(
          (payload as Record<string, unknown>).data as string
        );
      } catch {
        // leave as-is if not parseable
      }
    }

    const p = (payload as Record<string, unknown>) || {};

    const extractNumber = (k1: string, k2?: string, fallback = 0): number => {
      const v1 = p[k1];
      const v2 = k2 ? p[k2] : undefined;
      if (typeof v1 === "number") return v1;
      if (typeof v2 === "number") return v2;
      if (typeof v1 === "string") return Number(v1) || fallback;
      if (typeof v2 === "string") return Number(v2) || fallback;
      return fallback;
    };

    const technologyCountsRaw =
      (p["technologyCounts"] as Record<string, number> | undefined) ||
      (p["technology_counts"] as Record<string, number> | undefined) ||
      (p["technologies"] as Record<string, number> | undefined) ||
      {};

    const technologyCounts: Record<string, number> = {};
    // coerce values to numbers
    Object.entries(technologyCountsRaw || {}).forEach(([k, v]) => {
      technologyCounts[k] = typeof v === "number" ? v : Number(v) || 0;
    });

    const totalPostings = extractNumber("totalPostings", "total_postings", 0);
    const totalTechnologies = extractNumber(
      "totalTechnologies",
      "total_technologies",
      Object.keys(technologyCounts).length
    );
    const totalSkills = extractNumber("totalSkills", "total_skills", 0);

    const skillCountsRaw =
      (p["skillCounts"] as Record<string, number> | undefined) ||
      (p["skill_counts"] as Record<string, number> | undefined) ||
      undefined;
    const skillCounts = skillCountsRaw
      ? Object.fromEntries(
          Object.entries(skillCountsRaw).map(([k, v]) => [
            k,
            typeof v === "number" ? v : Number(v) || 0,
          ])
        )
      : undefined;

    const pData = p["data"];
    const rawItems = Array.isArray(p["items"])
      ? (p["items"] as unknown[])
      : pData &&
        typeof pData === "object" &&
        Array.isArray((pData as Record<string, unknown>).items)
      ? ((pData as Record<string, unknown>).items as unknown[])
      : undefined;

    // Narrow rawItems to ExtendedJobPosting[] if possible
    let items: ExtendedJobPosting[] | undefined = undefined;
    if (rawItems && Array.isArray(rawItems)) {
      items = rawItems
        .filter((it) => it && typeof it === "object")
        .map((it) => {
          const r = it as Record<string, unknown>;
          return {
            Id: String(r["Id"] ?? r["id"] ?? r["jobId"] ?? ""),
            title: String(r["title"] ?? r["job_title"] ?? ""),
            skills: Array.isArray(r["skills"]) ? (r["skills"] as string[]) : [],
            technologies: Array.isArray(r["technologies"])
              ? (r["technologies"] as string[])
              : [],
            raw_text: String(r["raw_text"] ?? r["description"] ?? ""),
            date: String(r["date"] ?? r["processed_date"] ?? ""),
            source_file: String(r["source_file"] ?? r["source"] ?? ""),
          } as ExtendedJobPosting;
        });
      if (items.length === 0) items = undefined;
    }

    return {
      totalPostings,
      totalTechnologies,
      totalSkills,
      technologyCounts,
      skillCounts,
      items,
    };
  } catch (error) {
    console.error("Failed to fetch job postings stats:", error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Failed to fetch stats");
    }
    throw error;
  }
};

/**
 * Get unique technologies across all job postings
 */
export const getUniqueTechnologies = (jobPostings: JobPosting[]): string[] => {
  const techSet = new Set<string>();
  jobPostings.forEach((posting) => {
    posting.technologies.forEach((tech) => techSet.add(tech));
  });
  return Array.from(techSet).sort();
};

/**
 * Count technology occurrences
 */
export const getTechnologyCounts = (
  jobPostings: JobPosting[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  jobPostings.forEach((posting) => {
    posting.technologies.forEach((tech) => {
      counts[tech] = (counts[tech] || 0) + 1;
    });
  });
  return counts;
};
