import axios from "axios";

// Replace this with your actual API Gateway URL
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod";
import type {
  JobStats,
  BaseJobListing,
  TechnologyStatItem,
  SkillStatItem,
} from "@/shared-types";

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

/**
 * Fetch aggregated job postings stats (counts) from the API
 */
export const getJobPostingsStats = async (): Promise<JobStats> => {
  try {
    console.log();
    const response = await axios.get(`${API_URL}/job-stats`);
    console.log(response.data);

    let payload = response.data;
    console.log("Raw payload:", payload);

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
    // Helper: parse DynamoDB-style list items into stat items.
    // Dynamo shape examples:
    // { M: { count: { N: "463" }, id: { S: "python" } } }
    const parseDynamoStatList = (
      val: unknown
    ): Array<{ id: string; name?: string; count: number }> => {
      const out: Array<{ id: string; name?: string; count: number }> = [];
      if (!Array.isArray(val)) return out;
      for (const entry of val) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const maybeM = ("M" in e && e.M ? e.M : "m" in e && e.m ? e.m : e) as
          | Record<string, unknown>
          | undefined;
        if (!maybeM || typeof maybeM !== "object") continue;
        const m = maybeM as Record<string, unknown>;

        // Extract id
        let rawId: unknown = undefined;
        if (
          m["id"] &&
          typeof m["id"] === "object" &&
          (m["id"] as Record<string, unknown>)["S"]
        ) {
          rawId = (m["id"] as Record<string, unknown>)["S"];
        } else if (m["id"] !== undefined) {
          rawId = m["id"];
        } else if (
          m["Name"] &&
          typeof m["Name"] === "object" &&
          (m["Name"] as Record<string, unknown>)["S"]
        ) {
          rawId = (m["Name"] as Record<string, unknown>)["S"];
        } else if (m["name"] !== undefined) {
          rawId = m["name"];
        } else if (m["ID"] !== undefined) {
          rawId = m["ID"];
        }

        // Extract count
        let rawCount: unknown = undefined;
        if (
          m["count"] &&
          typeof m["count"] === "object" &&
          (m["count"] as Record<string, unknown>)["N"]
        ) {
          rawCount = (m["count"] as Record<string, unknown>)["N"];
        } else if (m["count"] !== undefined) {
          rawCount = m["count"];
        } else if (m["Count"] !== undefined) {
          rawCount = m["Count"];
        }

        if (rawId == null) continue;
        const id = String(rawId);
        const count =
          typeof rawCount === "number"
            ? rawCount
            : typeof rawCount === "string"
            ? Number(rawCount)
            : NaN;
        if (Number.isNaN(count)) continue;
        out.push({ id, name: id, count });
      }
      return out;
    };

    // Try multiple keys: backend may return 'technologyCounts' as map or
    // 'technologies' as a DynamoDB-style list. Prefer list parsing when present.
    const rawTechnologiesList =
      (p["technologies"] as unknown[]) ??
      (p["technologyCounts"] as unknown[]) ??
      (p["technologies_list"] as unknown[]) ??
      undefined;

    const technologiesParsed = parseDynamoStatList(rawTechnologiesList);

    // Build a map name -> count for downstream use
    const technologyCounts: Record<string, number> = {};
    if (technologiesParsed && technologiesParsed.length > 0) {
      technologiesParsed.forEach((t) => {
        technologyCounts[t.id] =
          (technologyCounts[t.id] || 0) + (Number(t.count) || 0);
      });
    } else {
      // Fallback: if backend returned a plain map like { python: 123, js: 456 }
      const technologyCountsRaw =
        (p["technologyCounts"] as Record<string, number> | undefined) ||
        (p["technology_counts"] as Record<string, number> | undefined) ||
        (p["technologies_map"] as Record<string, number> | undefined) ||
        {};
      Object.entries(technologyCountsRaw || {}).forEach(([k, v]) => {
        technologyCounts[k] = typeof v === "number" ? v : Number(v) || 0;
      });
    }

    const totalPostings = extractNumber("totalPostings", "total_postings", 0);
    // const totalTechnologies = extractNumber(
    //   "totalTechnologies",
    //   "total_technologies",
    //   Object.keys(technologyCounts).length
    // );

    // Parse skills from DynamoDB-style list or fallback to map
    const rawSkillsList =
      (p["skills"] as unknown[]) ??
      (p["skillCounts"] as unknown[]) ??
      undefined;
    const skillsParsed = parseDynamoStatList(rawSkillsList);
    const skillCounts: Record<string, number> | undefined =
      skillsParsed && skillsParsed.length > 0
        ? Object.fromEntries(skillsParsed.map((s) => [s.id, s.count]))
        : (p["skillCounts"] as Record<string, number> | undefined) ||
          (p["skill_counts"] as Record<string, number> | undefined) ||
          undefined;

    const pData = p["data"];
    const rawItems = Array.isArray(p["items"])
      ? (p["items"] as unknown[])
      : pData &&
        typeof pData === "object" &&
        Array.isArray((pData as Record<string, unknown>).items)
      ? ((pData as Record<string, unknown>).items as unknown[])
      : undefined;

    // Narrow rawItems to BaseJobListing[] if possible
    let items: BaseJobListing[] | undefined = undefined;
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
          } as unknown as BaseJobListing;
        });
      if (items?.length === 0) items = undefined;
    }

    // Build typed arrays using base types from shared-types
    const skillsArray: SkillStatItem[] =
      skillsParsed && skillsParsed.length > 0
        ? (skillsParsed.map((s) => ({
            id: s.id,
            name: s.name,
            count: s.count,
          })) as SkillStatItem[])
        : skillCounts
        ? Object.entries(skillCounts).map(([name, count]) => ({
            id: name,
            name,
            count,
          }))
        : [];

    const technologiesArray: TechnologyStatItem[] =
      technologiesParsed && technologiesParsed.length > 0
        ? (technologiesParsed.map((t) => ({
            id: t.id,
            name: t.name,
            count: t.count,
          })) as TechnologyStatItem[])
        : Object.entries(technologyCounts).map(([name, count]) => ({
            id: name,
            name,
            count,
          }));

    const requirementsCounts =
      typeof p["requirementsCounts"] === "number"
        ? (p["requirementsCounts"] as number)
        : typeof p["requirements_counts"] === "number"
        ? (p["requirements_counts"] as number)
        : undefined;
    const industriesCounts =
      typeof p["industriesCounts"] === "number"
        ? (p["industriesCounts"] as number)
        : typeof p["industries_counts"] === "number"
        ? (p["industries_counts"] as number)
        : undefined;
    const benefitCounts =
      typeof p["benefitCounts"] === "number"
        ? (p["benefitCounts"] as number)
        : typeof p["benefit_counts"] === "number"
        ? (p["benefit_counts"] as number)
        : undefined;

    const updatedAt =
      (p["updatedAt"] as string) ??
      (p["updated_at"] as string) ??
      new Date().toISOString();

    // Build a strict JobStats object using the shared types.
    // Prefer explicit totals from the payload when available; otherwise
    // compute deterministic totals from the counts maps (number of distinct keys).
    const computedTotalTechnologies = Object.keys(technologyCounts).length;
    const computedTotalSkills = skillCounts
      ? Object.keys(skillCounts).length
      : 0;

    const totalTechnologiesFinal =
      typeof p["totalTechnologies"] === "number"
        ? (p["totalTechnologies"] as number)
        : typeof p["total_technologies"] === "number"
        ? (p["total_technologies"] as number)
        : computedTotalTechnologies;

    const totalSkillsFinal =
      typeof p["totalSkills"] === "number"
        ? (p["totalSkills"] as number)
        : typeof p["total_skills"] === "number"
        ? (p["total_skills"] as number)
        : computedTotalSkills;

    const jobStats: JobStats = {
      skills: skillsArray,
      technologies: technologiesArray.length ? technologiesArray : undefined,
      requirementsCounts,
      industriesCounts,
      benefitCounts,
      totalPostings,
      totalSkills: totalSkillsFinal,
      totalTechnologies: totalTechnologiesFinal,
      updatedAt,
    };

    return jobStats;
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
// export const getUniqueTechnologies = (
//   jobPostings: BaseJobListing[]
// ): string[] => {
//   const techSet = new Set<string>();
//   jobPostings.forEach((posting) => {
//     posting.technologies.forEach((tech) => techSet.add(tech));
//   });
//   return Array.from(techSet).sort();
// };

/**
 * Count technology occurrences
 */
// export const getTechnologyCounts = (
//   jobPostings: BaseJobListing[]
// ): Record<string, number> => {
//   const counts: Record<string, number> = {};
//   jobPostings.forEach((posting) => {
//     posting.technologies.forEach((tech) => {
//       counts[tech] = (counts[tech] || 0) 1;
//     });
//   });
//   return counts;
// };
