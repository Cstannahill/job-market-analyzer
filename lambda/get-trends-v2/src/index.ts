import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ok,
  bad,
  clampInt,
  requireParam,
  canonical,
  groupBy,
  sum,
  medianOf,
  mostCommon,
  uniqBy,
  pickPreferredRow,
} from "./utils.js";
import { weightedMedian } from "./utils.js";
import { getReqId, log, pick, preview, type Ctx } from "./logging.js";
import { pivotModeSeniority } from "./pivot.js";
import type {
  SkillTrendV2Item,
  TopTechnologiesItem,
  RisingTechnologiesItem,
  TechnologyDetailResponse,
  TrendsOverviewResponse,
  WorkMode,
  Seniority,
  Period,
} from "@job-market-analyzer/types/trendsv2";
type ApiEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;
type ApiResult = APIGatewayProxyResult | APIGatewayProxyStructuredResultV2;

const TRENDS_TABLE = process.env.TRENDS_TABLE || "skill-trends-v2";
const TOTALS_TABLE = process.env.TOTALS_TABLE || "job-postings-totals";
const TIME_INDEX = process.env.TIME_INDEX || "TimeIndex";
const REGION_INDEX = process.env.REGION_INDEX || "RegionIndex";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const handler = async (event: ApiEvent): Promise<ApiResult> => {
  const ctx: Ctx = { rid: getReqId(event) };
  const method =
    (event as any).requestContext?.http?.method ||
    (event as APIGatewayProxyEvent).httpMethod ||
    "GET";

  const rawPath =
    (event as any).rawPath ||
    (event as any).requestContext?.http?.path ||
    (event as APIGatewayProxyEvent).path ||
    "";

  const path = rawPath.toLowerCase();
  const query =
    (event as any).queryStringParameters ||
    (event as APIGatewayProxyEvent).queryStringParameters ||
    {};

  if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };

  log(ctx, "info", "request", { method, path, query });

  try {
    if (path.endsWith("/v2/trends/technologies/top")) {
      const region = (query.region ?? "US").toUpperCase();
      const period = requireParam(query.period, "period");
      const limit = clampInt(query.limit, 20, 1, 100);
      const data = await getTopTechnologies({ region, period, limit, ctx });
      const mapped = data.map(toTopTechnologiesItem);
      log(ctx, "info", "top.done", { count: mapped.length });
      return ok({ region, period, count: mapped.length, data: mapped });
    }

    if (path.endsWith("/v2/trends/technologies/rising")) {
      const region = (query.region ?? "US").toUpperCase();
      const period = requireParam(query.period, "period");
      const limit = clampInt(query.limit, 20, 1, 100);
      const data = await getRisingTechnologies({ region, period, limit, ctx });
      const mapped = data.map(toTopTechnologiesItem);
      log(ctx, "info", "rising.done", { count: mapped.length });
      return ok({ region, period, count: mapped.length, data: mapped });
    }

    if (path.includes("/v2/trends/technology/")) {
      const name = decodeURIComponent(
        path.split("/v2/trends/technology/")[1] || ""
      ).trim();
      if (!name) return bad("Missing technology name in path");
      const region = (query.region ?? "US").toUpperCase();
      const period = requireParam(query.period, "period");
      const data = await getTechnologyDetail({
        tech: name,
        region,
        period,
        ctx,
      });
      log(ctx, "info", "detail.done", {
        tech: name,
        slices: {
          work_mode: data.by_work_mode?.length ?? 0,
          seniority: data.by_seniority?.length ?? 0,
        },
      });
      return ok({ technology: name, region, period, ...data });
    }

    if (path.endsWith("/v2/trends/overview")) {
      const region = (query.region ?? "US").toUpperCase();
      const period = requireParam(query.period, "period");
      const limit = clampInt(query.limit, 10, 1, 50);
      const data = await getOverview({ region, period, limit, ctx });
      log(ctx, "info", "overview.done", {
        total_postings: data.total_postings,
        topLen: data.top_technologies.length,
      });
      return ok({ region, period, ...data });
    }
    if (path.endsWith("/v2/trends/weeks")) {
      const data = await getGlobalPeriods();
      return ok(data);
    }
    return bad("Invalid endpoint");
  } catch (err: any) {
    log(ctx, "error", "unhandled", { error: err?.message, stack: err?.stack });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: err?.message || String(err),
      }),
    };
  }
};

async function getTopTechnologies(opts: {
  region: string;
  period: string;
  limit: number;
  ctx?: { rid: string };
}): Promise<SkillTrendV2Item[]> {
  const { region, period, limit, ctx } = opts;

  const pageSize = Math.max(limit * 5, 100);
  log(ctx, "debug", "top.query-gsi.start", {
    period,
    pageSize,
    index: TIME_INDEX,
  });

  const q = await dynamo.send(
    new QueryCommand({
      TableName: TRENDS_TABLE,
      IndexName: TIME_INDEX,
      KeyConditionExpression: "#p = :period",
      ExpressionAttributeNames: { "#p": "period" },
      ExpressionAttributeValues: { ":period": period },
      ProjectionExpression:
        "skill_canonical, region_seniority_mode_period, #p, job_count_desc",
      ScanIndexForward: false,
      Limit: pageSize,
    })
  );

  const keys = (q.Items ?? []).map((it) => ({
    skill_canonical: it.skill_canonical,
    region_seniority_mode_period: it.region_seniority_mode_period,
  }));
  log(ctx, "debug", "top.query-gsi.done", {
    gsiCount: q.Count,
    keys: keys.length,
    preview: preview(q.Items ?? [], [
      "skill_canonical",
      "region_seniority_mode_period",
      "job_count_desc",
    ]),
  });

  if (!keys.length) return [];

  const batches: any[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    const slice = keys.slice(i, i + 100);
    log(ctx, "debug", "top.batchget.start", {
      batch: `${i}-${i + slice.length}`,
    });

    const resp = await dynamo.send(
      new BatchGetCommand({
        RequestItems: {
          [TRENDS_TABLE]: {
            Keys: slice.map((k) => ({
              skill_canonical: k.skill_canonical,
              region_seniority_mode_period: k.region_seniority_mode_period,
            })),
            ExpressionAttributeNames: { "#r": "region" },
            ProjectionExpression: [
              "skill_canonical",
              "#r",
              "seniority",
              "work_mode",
              "period",
              "job_count",
              "regional_share",
              "global_share",
              "salary_median",
              "salary_p75",
              "salary_p95",
              "trend_signal",
              "job_count_change_pct",
              "cooccurring_skills",
              "industry_distribution",
              "top_titles",
            ].join(", "),
          },
        },
      })
    );

    const got = resp.Responses?.[TRENDS_TABLE] ?? [];
    log(ctx, "debug", "top.batchget.done", {
      got: got.length,
      preview: preview(got, [
        "skill_canonical",
        "region",
        "work_mode",
        "job_count",
        "salary_median",
      ]),
    });
    batches.push(...got);
  }

  const regionRows = batches.filter(
    (x) => String(x.region).toUpperCase() === region
  );
  if (!regionRows.length) {
    log(ctx, "warn", "top.no-rows-for-region", {
      region,
      have: batches.length,
      sample: preview(batches, ["region", "work_mode", "skill_canonical"]),
    });
  }

  const byTechMap = new Map<string, any[]>();
  for (const r of regionRows) {
    const k = r.skill_canonical;
    if (!byTechMap.has(k)) byTechMap.set(k, []);
    byTechMap.get(k)!.push(r);
  }

  const picked: any[] = [];
  for (const [tech, list] of byTechMap) {
    const chosen = pickPreferredRow(list);
    if (!chosen) {
      log(ctx, "warn", "top.pickPreferredRow.none", {
        tech,
        listLen: list.length,
      });
      continue;
    }
    if (chosen.salary_median == null) {
      log(ctx, "debug", "top.picked.no-salary", {
        tech,
        work_mode: chosen.work_mode,
        job_count: chosen.job_count,
      });
    }
    picked.push(chosen);
  }

  picked.sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0));
  const out = picked.slice(0, limit).map(normalizeTrendRow);
  log(ctx, "info", "top.out", {
    outLen: out.length,
    preview: preview(out, [
      "skill_canonical",
      "work_mode",
      "job_count",
      "salary_median",
      "regional_share",
    ]),
  });
  return out;
}

async function getRisingTechnologies(opts: {
  region: string;
  period: string;
  limit: number;
  ctx?: { rid: string };
}): Promise<SkillTrendV2Item[]> {
  const { region, period, limit, ctx } = opts;
  const base = await getTopTechnologies({
    region,
    period,
    limit: Math.max(limit * 5, 60),
    ctx,
  });

  const rising = base
    .filter(
      (x) =>
        x.trend_signal === "rising" &&
        typeof x.job_count_change_pct === "number"
    )
    .sort(
      (a, b) => (b.job_count_change_pct ?? 0) - (a.job_count_change_pct ?? 0)
    )
    .slice(0, limit);

  log(ctx, "info", "rising.out", {
    baseLen: base.length,
    risingLen: rising.length,
    preview: preview(rising, [
      "skill_canonical",
      "job_count_change_pct",
      "job_count",
    ]),
  });
  return rising;
}

async function getTechnologyDetail(opts: {
  tech: string;
  region: string;
  period: string;
  ctx?: { rid: string };
}): Promise<
  Omit<TechnologyDetailResponse, "technology" | "region" | "period">
> {
  const { tech, region, period, ctx } = opts;

  log(ctx, "debug", "detail.query.start", {
    tech: canonical(tech),
    region,
    period,
  });

  const res = await dynamo.send(
    new QueryCommand({
      TableName: TRENDS_TABLE,
      KeyConditionExpression: "#pk = :skill",
      ExpressionAttributeNames: { "#pk": "skill_canonical" },
      ExpressionAttributeValues: { ":skill": canonical(tech) },
    })
  );

  const rows = (res.Items ?? []).filter(
    (x) =>
      String(x.region).toUpperCase() === region && String(x.period) === period
  );

  log(ctx, "debug", "detail.rows", {
    total: res.Count,
    afterFilter: rows.length,
    preview: preview(rows, [
      "skill_canonical",
      "region",
      "period",
      "work_mode",
      "seniority",
      "job_count",
      "salary_median",
    ]),
  });

  let summary =
    rows.find((r) => r.work_mode === "All" && r.seniority === "All") ?? null;

  if (!summary && rows.length) {
    log(ctx, "warn", "detail.no-all-row", {
      tech,
      haveModes: [...new Set(rows.map((r) => r.work_mode))],
      haveSeniority: [...new Set(rows.map((r) => r.seniority))],
    });
    summary = synthesizeSummary(rows);
    log(ctx, "debug", "detail.synthesized", {
      summary: pick(summary, [
        "work_mode",
        "seniority",
        "job_count",
        "salary_median",
        "regional_share",
      ]),
    });
  }

  const byWorkModeSeniority = groupBy(
    rows.filter((r) => r.work_mode !== "All" && r.seniority !== "All"),
    (r) => `${r.work_mode}|${r.seniority}`
  );

  const by_work_mode = Array.from(byWorkModeSeniority.entries())
    .map(([key, list]) => {
      const [work_mode, seniority] = key.split("|");
      const row = list[0];

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
      if (a.work_mode !== b.work_mode) {
        return a.work_mode.localeCompare(b.work_mode);
      }
      return (b.job_count ?? 0) - (a.job_count ?? 0);
    });

  const bySeniority = groupBy(
    rows.filter((r) => r.seniority !== "All"),
    (r) => r.seniority
  );

  const by_seniority = Array.from(bySeniority.entries())
    .map(([level, list]) => {
      const totalJobs = sum(list, "job_count");

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

  log(ctx, "info", "detail.out", {
    tech,
    rows: rows.length,
    hasSummary: !!summary,
    by_work_mode_entries: by_work_mode.length,
    by_seniority_entries: by_seniority.length,
  });

  const normalizedSummary = summary ? normalizeTrendRow(summary) : null;

  return {
    summary: normalizedSummary,
    by_work_mode: by_work_mode.map((row) => ({
      work_mode: row.work_mode as WorkMode,
      seniority: row.seniority as Seniority,
      job_count: row.job_count ?? 0,
      salary_median: row.salary_median,
      salary_p75: row.salary_p75,
      salary_p95: row.salary_p95,
      regional_share: row.regional_share,
      global_share: row.global_share,
    })),
    by_seniority: by_seniority.map((row) => ({
      level: row.level as Seniority,
      job_count: row.job_count ?? 0,
      salary_median: row.salary_median,
    })),
    cooccurring_skills:
      normalizedSummary?.cooccurring_skills ??
      mostCommon(rows, "cooccurring_skills", 10),
    industry_distribution:
      normalizedSummary?.industry_distribution ??
      mostCommon(rows, "industry_distribution", 10),
    top_titles:
      normalizedSummary?.top_titles ?? mostCommon(rows, "top_titles", 5),
  };
}

function synthesizeSummary(rows: any) {
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

async function getOverview(opts: {
  region: string;
  period: string;
  limit: number;
  ctx?: Ctx;
}): Promise<Omit<TrendsOverviewResponse, "region" | "period">> {
  const { region, period, limit, ctx } = opts;

  log(ctx, "debug", "overview.start", { region, period, limit });

  const totals = await dynamo.send(
    new GetCommand({
      TableName: TOTALS_TABLE,
      Key: { period, region },
    })
  );
  const total_postings = totals.Item?.job_count ?? 0;

  log(ctx, "debug", "overview.totals", {
    hasItem: !!totals.Item,
    job_count: total_postings,
  });

  const top = await getTopTechnologies({ region, period, limit, ctx });
  const topItems = top.map(toTopTechnologiesItem);

  const remote_share_est = (() => {
    const allRow = top.find((x) => x.work_mode === "All");
    return allRow?.remote_share ?? undefined;
  })();

  const out = {
    total_postings,
    remote_share: remote_share_est,
    top_technologies: topItems,
  };

  log(ctx, "info", "overview.out", {
    total_postings,
    topLen: top.length,
    preview: top.slice(0, 3).map((t) => ({
      tech: t.skill_canonical,
      mode: t.work_mode,
      count: t.job_count,
      p50: t.salary_median,
    })),
  });

  return out;
}

function normalizeTrendRow(row: Record<string, any>): SkillTrendV2Item {
  const skillCanonical = String(row.skill_canonical ?? "").trim();
  const region = String(row.region ?? "GLOBAL");
  const seniority = (row.seniority ?? "Unknown") as Seniority;
  const workMode = (row.work_mode ?? "All") as WorkMode;
  const period = String(row.period ?? "") as Period;
  const jobCount =
    typeof row.job_count === "number"
      ? row.job_count
      : Number(row.job_count) || 0;

  return {
    skill_canonical: skillCanonical,
    skill_display: String(row.skill_display ?? skillCanonical),
    region,
    seniority,
    work_mode: workMode,
    period,
    region_seniority_mode_period:
      row.region_seniority_mode_period ??
      `${region}#${seniority}#${workMode}#${period}`,
    period_skill: row.period_skill ?? `${period}#${skillCanonical}`,
    job_count_desc:
      row.job_count_desc ??
      `${String(jobCount).padStart(6, "0")}#${skillCanonical}#${region}`,
    job_count: jobCount,
    salary_min: numberOrUndefined(row.salary_min),
    salary_max: numberOrUndefined(row.salary_max),
    salary_median: numberOrUndefined(row.salary_median),
    salary_p75: numberOrUndefined(row.salary_p75),
    salary_p95: numberOrUndefined(row.salary_p95),
    regional_share: numberOrUndefined(row.regional_share),
    global_share: numberOrUndefined(row.global_share),
    remote_share: numberOrUndefined(row.remote_share),
    cooccurring_skills: normalizeCountMap(row.cooccurring_skills),
    industry_distribution: normalizeCountMap(row.industry_distribution),
    top_titles: normalizeCountMap(row.top_titles),
    job_count_change_pct: numberOrUndefined(row.job_count_change_pct),
    median_salary_change_pct: numberOrUndefined(row.median_salary_change_pct),
    trend_signal: row.trend_signal,
    dimension: row.dimension,
  };
}

function toTopTechnologiesItem(row: SkillTrendV2Item): TopTechnologiesItem {
  return {
    skill_canonical: row.skill_canonical,
    skill_display: row.skill_display,
    region: row.region,
    work_mode: row.work_mode,
    period: row.period,
    job_count: row.job_count,
    regional_share: row.regional_share,
    global_share: row.global_share,
    salary_median: row.salary_median,
    salary_p75: row.salary_p75,
    salary_p95: row.salary_p95,
    trend_signal: row.trend_signal,
    remote_share: row.remote_share,
    job_count_change_pct: row.job_count_change_pct,
    cooccurring_skills: row.cooccurring_skills,
    industry_distribution: row.industry_distribution,
    top_titles: row.top_titles,
  };
}

const numberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (
    value &&
    typeof value === "object" &&
    "N" in (value as Record<string, unknown>)
  ) {
    return numberOrUndefined((value as Record<string, unknown>).N);
  }
  return undefined;
};

const normalizeCountMap = (
  value: unknown
): Record<string, number> | undefined => {
  if (!value) return undefined;
  const out: Record<string, number> = {};

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (
        entry &&
        typeof entry === "object" &&
        "key" in entry &&
        "value" in entry
      ) {
        const key = String((entry as Record<string, unknown>).key ?? "").trim();
        const num = numberOrUndefined((entry as Record<string, unknown>).value);
        if (key && num !== undefined) out[key] = num;
      } else if (typeof entry === "string") {
        out[entry] = (out[entry] ?? 0) + 1;
      }
    }
  } else if (typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const num = numberOrUndefined(val);
      if (key && num !== undefined) out[key] = num;
    }
  }

  return Object.keys(out).length ? out : undefined;
};

async function getGlobalPeriods(): Promise<string[]> {
  const periods: string[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const resp = await dynamo.send(
      new QueryCommand({
        TableName: "job-postings-totals",
        IndexName: "RegionIndex",
        KeyConditionExpression: "#region = :global",
        ExpressionAttributeNames: {
          "#region": "region",
          "#period": "period",
        },
        ExpressionAttributeValues: {
          ":global": "GLOBAL",
        },
        ProjectionExpression: "#period",
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of resp.Items ?? []) {
      periods.push(item.period);
    }

    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);

  return periods;
}
