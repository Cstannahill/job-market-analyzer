import { mostCommon, sum, weightedMedian } from "./techTrendsHelpers.js";
import type { EnrichedSkillData } from "./types.js";

export function synthesizeSummary(rows: any) {
  const job_count = sum(rows, "job_count");
  const total = job_count || 1;

  const remoteCount = rows
    .filter((r: any) => r.work_mode === "Remote")
    .reduce((t: number, r: any) => t + (r.job_count ?? 0), 0);
  const remote_share = remoteCount / total;

  const salaryData = rows
    .filter((r: any) => typeof r.salary_median === "number" && r.job_count > 0)
    .map((r: any) => ({ value: r.salary_median, weight: r.job_count }));

  const salary_median = weightedMedian(salaryData);

  const p75Data = rows
    .filter((r: any) => typeof r.salary_p75 === "number" && r.job_count > 0)
    .map((r: any) => ({ value: r.salary_p75, weight: r.job_count }));

  const salary_p75 = weightedMedian(p75Data);

  const p95Data = rows
    .filter((r: any) => typeof r.salary_p95 === "number" && r.job_count > 0)
    .map((r: any) => ({ value: r.salary_p95, weight: r.job_count }));

  const salary_p95 = weightedMedian(p95Data);

  const regional_share =
    rows
      .filter(
        (r: any) => typeof r.regional_share === "number" && r.job_count > 0
      )
      .reduce(
        (sum: number, r: any) => sum + r.regional_share * r.job_count,
        0
      ) / total;

  const global_share =
    rows
      .filter((r: any) => typeof r.global_share === "number" && r.job_count > 0)
      .reduce((sum: number, r: any) => sum + r.global_share * r.job_count, 0) /
    total;

  const cooccurring_skills = mostCommon(rows, "cooccurring_skills", 15);
  const industry_distribution = mostCommon(rows, "industry_distribution", 15);
  const top_titles = mostCommon(rows, "top_titles", 10);

  const base = rows[0];

  return {
    ...base,
    work_mode: "All",
    seniority: "All",
    job_count,
    remote_share,
    salary_median,
    salary_p75,
    salary_p95,
    regional_share,
    global_share,
    cooccurring_skills,
    industry_distribution,
    top_titles,
  };
}

export function summarizeSkillData(skills: EnrichedSkillData[]) {
  return {
    salaryRanges: skills.map((s) => ({
      skill: s.technology,
      junior:
        s.by_seniority.find((sen) => sen.level === "Junior")?.salary_median ||
        null,
      mid:
        s.by_seniority.find((sen) => sen.level === "Mid")?.salary_median ||
        null,
      senior:
        s.by_seniority.find((sen) => sen.level === "Senior")?.salary_median ||
        null,
      lead:
        s.by_seniority.find((sen) => sen.level === "Lead")?.salary_median ||
        null,
      marketDemand: s.job_count,
    })),

    skillStacks: skills.map((s) => ({
      skill: s.technology,
      commonlyPairedWith: Object.entries(s.cooccurring_skills)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([skill, count]) => ({
          skill,
          frequency: count,
          percentage: Math.round((count / s.job_count) * 100),
        })),
    })),

    commonRoles: skills.map((s) => ({
      skill: s.technology,
      topRoles: Object.entries(s.top_titles)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([title, count]) => ({ title, count })),
    })),
  };
}
