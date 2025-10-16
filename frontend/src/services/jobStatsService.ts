import axios from "axios";
import type {
  BaseJobListing,
  JobStats,
  SkillStatItem,
  TechnologyStatItem,
} from "@/shared-types";
const API_URL = import.meta.env.VITE_API_URL || "";
export const getJobPostingsStats = async (): Promise<JobStats> => {
  try {
    const response = await axios.get(`${API_URL}/job-stats`);

    let payload = {};

    try {
      payload = response.data.stats;
    } catch (error) {
      console.error("Failed to parse response data:", error);
    }

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
