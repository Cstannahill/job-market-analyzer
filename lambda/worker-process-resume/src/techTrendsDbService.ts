import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  canonical,
  groupBy,
  sum,
  mostCommon,
  weightedMedian,
} from "./techTrendsHelpers.js";
import { synthesizeSummary } from "./techTrends.js";
import { getReqId, log, pick, preview, type Ctx } from "./logging.js";
import { canonicalizeTech } from "./techNormalizer.js";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TRENDS_TABLE = process.env.TRENDS_TABLE || "skill-trends-v2";

export async function getTechnologyDetail(opts: {
  tech: string;
  region: string;
  period: string;
  ctx?: { rid: string };
}) {
  const { tech, region, period, ctx } = opts;
  const cleanTech = tech.toLowerCase();
  // console.log(tech, region, period);
  // log(ctx, "debug", "detail.query.start", {
  //   tech: canonical(cleanTech),
  //   region,
  //   period,
  // });

  const res = await dynamo.send(
    new QueryCommand({
      TableName: TRENDS_TABLE,
      KeyConditionExpression: "#pk = :skill",
      ExpressionAttributeNames: { "#pk": "skill_canonical" },
      ExpressionAttributeValues: { ":skill": canonical(cleanTech) },
    })
  );

  const rows = (res.Items ?? []).filter(
    (x) =>
      String(x.region).toUpperCase() === region && String(x.period) === period
  );

  // log(ctx, "debug", "detail.rows", {
  //   total: res.Count,
  //   afterFilter: rows.length,
  //   preview: preview(rows, [
  //     "skill_canonical",
  //     "region",
  //     "period",
  //     "work_mode",
  //     "seniority",
  //     "job_count",
  //     "salary_median",
  //   ]),
  // });

  // Find summary row (All, All)
  let summary =
    rows.find((r) => r.work_mode === "All" && r.seniority === "All") ?? null;

  if (!summary && rows.length) {
    // log(ctx, "warn", "detail.no-all-row", {
    //   tech,
    //   haveModes: [...new Set(rows.map((r) => r.work_mode))],
    //   haveSeniority: [...new Set(rows.map((r) => r.seniority))],
    // });
    // summary = synthesizeSummary(rows);
    // log(ctx, "debug", "detail.synthesized", {
    //   summary: pick(summary, [
    //     "work_mode",
    //     "seniority",
    //     "job_count",
    //     "salary_median",
    //     "regional_share",
    //   ]),
    // });
  }

  // Group by work_mode x seniority for proper breakdown
  const byWorkModeSeniority = groupBy(
    rows.filter((r) => r.work_mode !== "All" && r.seniority !== "All"),
    (r) => `${r.work_mode}|${r.seniority}`
  );

  // Create work_mode breakdown with seniority levels
  const by_work_mode = Array.from(byWorkModeSeniority.entries())
    .map(([key, list]) => {
      const [work_mode, seniority] = key.split("|");
      const row = list[0]; // Should only be one row per combination

      return {
        work_mode,
        seniority,
        job_count: row.job_count,
        salary_median: row.salary_median,
        salary_p75: row.salary_p75,
        salary_p95: row.salary_p95,
        regional_share: row.regional_share,
        global_share: row.global_share,
      };
    })
    .sort((a, b) => {
      // Sort by work_mode first, then by job_count desc
      if (a.work_mode !== b.work_mode) {
        return a.work_mode.localeCompare(b.work_mode);
      }
      return (b.job_count ?? 0) - (a.job_count ?? 0);
    });

  // Aggregate by seniority level across all work modes
  const bySeniority = groupBy(
    rows.filter((r) => r.seniority !== "All"),
    (r) => r.seniority
  );

  const by_seniority = Array.from(bySeniority.entries())
    .map(([level, list]) => {
      const totalJobs = sum(list, "job_count");

      // Use weighted median for more accurate salary representation
      const salaryData = list
        .filter((r) => typeof r.salary_median === "number" && r.job_count > 0)
        .map((r) => ({ value: r.salary_median, weight: r.job_count }));

      const salary_median = weightedMedian(salaryData);

      return {
        level,
        job_count: totalJobs,
        salary_median,
      };
    })
    .sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0));

  // log(ctx, "info", "detail.out", {
  //   tech,
  //   rows: rows.length,
  //   hasSummary: !!summary,
  //   by_work_mode_entries: by_work_mode.length,
  //   by_seniority_entries: by_seniority.length,
  // });

  return {
    summary,
    by_work_mode,
    by_seniority,
    cooccurring_skills:
      summary?.cooccurring_skills ?? mostCommon(rows, "cooccurring_skills", 10),
    industry_distribution:
      summary?.industry_distribution ??
      mostCommon(rows, "industry_distribution", 10),
    top_titles: summary?.top_titles ?? mostCommon(rows, "top_titles", 5),
  };
}
