// lambdas/aggregate-skill-trends-v2/handler.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { TrendItem, Seniority, WorkMode, Period, Event } from "./types.js";
import { toWeek, toDay, weekDates } from "./compute/buckets.js";
import {
  canonicalizeTech,
  canonicalizeSoftSkill,
  selectPrimarySet,
  AggDim,
} from "./normalizers/skills.js";
import { parseLocation } from "./normalizers/location.js";
import { parseSalaryRange, percentiles } from "./normalizers/salary.js";
import {
  previousPeriod,
  trendSignal,
  chunk,
  makeSK,
} from "./compute/momentum.js";
import { zeroPad, topN } from "./compute/stats.js";
import { batchWriteAll } from "./ddb.js";
const AGG_DIM = (process.env.AGG_DIM as AggDim) ?? "technology";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const SRC_TABLE = process.env.SRC_TABLE!;
const SRC_GSI = process.env.SRC_GSI!; // e.g. JobsByDayIndex
const SRC_PK_ATTR = process.env.SRC_PK_ATTR ?? "processed_day"; // PK name for that GSI
const TRENDS_TABLE = process.env.TRENDS_TABLE!;
const TOTALS_TABLE = process.env.TOTALS_TABLE!;
const GRANULARITY = (process.env.GRANULARITY ?? "weekly") as "weekly" | "daily";
const PERIOD = process.env.FORCE_PERIOD as string | undefined;

type AggKey = `${string}|${string}|${Seniority}|${WorkMode}|${string}`;
//             region | skill  | seniority   | mode    | period

export const handler = async () => {
  const now = new Date();
  const period: Period =
    (PERIOD as Period) ?? (GRANULARITY === "weekly" ? toWeek(now) : toDay(now));

  // 1) Load source rows for the period (no scans)
  const days =
    GRANULARITY === "weekly" ? weekDates(period as any) : [period as string];
  const postings: any[] = [];
  for (const day of days) {
    const page = await ddb.send(
      new QueryCommand({
        TableName: SRC_TABLE,
        IndexName: SRC_GSI,
        KeyConditionExpression: "#k = :v",
        ExpressionAttributeNames: {
          "#k": SRC_PK_ATTR, // e.g. processed_day
          "#loc": "location", // alias reserved word
        },
        ExpressionAttributeValues: { ":v": day },
        ProjectionExpression: [
          "jobId",
          "job_title",
          "#loc", // ← use alias here
          "remote_status",
          "seniority_level",
          "industry",
          "salary_mentioned",
          "salary_range",
          "skills",
          "technologies",
        ].join(", "),
      })
    );
    postings.push(...(page.Items ?? []));
  }

  // 2) Aggregate
  const totalsByRegion = new Map<string, Set<string>>(); // distinct jobIds
  const salaryBuckets = new Map<string, number[]>(); // AggKey -> salaries
  const counts = new Map<string, number>(); // AggKey -> job_count
  const remoteCounts = new Map<string, number>(); // AggKey(…All…) -> remote only
  const coMap = new Map<string, Record<string, number>>();
  const industries = new Map<string, Record<string, number>>();
  const titles = new Map<string, Record<string, number>>();

  for (const j of postings) {
    const jobId = String(j.jobId);
    const title = String(j.job_title ?? "").trim();
    const industry = normIndustry(String(j.industry ?? "Unknown"));
    const seniority = normSeniority(String(j.seniority_level ?? "Unknown"));
    const mode = normWorkMode(String(j.remote_status ?? "On-site"));
    const { region, country } = parseLocation(String(j.location ?? ""));
    const techsRaw = extractStrings(j.technologies);
    const skillsRaw = extractStrings(j.skills);

    const techs = canonicalizeTech(techsRaw);
    const softSkills = canonicalizeSoftSkill(skillsRaw);

    const primary = selectPrimarySet(techs, softSkills, AGG_DIM);
    if (primary.length === 0) continue;
    const regions = uniqueRegions(region, country);
    const salary = parseSalaryRange(
      String(j.salary_range ?? ""),
      Boolean(j.salary_mentioned)
    );

    for (const r of regions) {
      if (!totalsByRegion.has(r)) totalsByRegion.set(r, new Set<string>());
      totalsByRegion.get(r)!.add(jobId);
    }

    for (const s of primary) {
      const coSet = new Set(primary.filter((k) => k !== s));
      for (const r of regions) {
        const kMode: AggKey = `${r}|${s}|${seniority}|${mode}|${period}`;
        const kAll: AggKey = `${r}|${s}|${seniority}|All|${period}`;

        inc(counts, kMode);
        inc(counts, kAll);
        if (mode === "Remote") inc(remoteCounts, kAll);

        if (salary?.annualUSD != null) {
          push(salaryBuckets, kMode, salary.annualUSD);
          push(salaryBuckets, kAll, salary.annualUSD);
        }

        add(industries, kMode, industry);
        add(industries, kAll, industry);
        add(titles, kMode, title);
        add(titles, kAll, title);

        for (const c of coSet) {
          add(coMap, kMode, c);
          add(coMap, kAll, c);
        }
      }
    }
  }

  // 3) Build TrendItems
  const totals: Record<string, number> = Object.fromEntries(
    [...totalsByRegion.entries()].map(([r, set]) => [r, set.size])
  );
  const globalTotal = totals["GLOBAL"] ?? 0;

  const items: TrendItem[] = [];

  for (const [key, job_count] of counts.entries()) {
    const [region, skill, seniority, work_mode, periodStr] = key.split("|") as [
      string,
      string,
      Seniority,
      WorkMode,
      string
    ];
    const sal = salaryBuckets.get(key) ?? [];
    const p = percentiles(sal);
    const ind = topN(industries.get(key), 8);
    const ttl = topN(titles.get(key), 5);
    const co = topN(coMap.get(key), 10);

    const period_skill = `${periodStr}#${skill}`;
    const job_count_desc = `${zeroPad(job_count)}#${skill}#${region}`;

    // shares only meaningful on All mode (but we can compute per mode too if desired)
    const regional_total = totals[region] ?? 0;
    const regional_share = regional_total
      ? job_count / regional_total
      : undefined;
    const global_share = globalTotal ? job_count / globalTotal : undefined;

    const prevP = previousPeriod(periodStr);
    // momentum: fetch previous item for same tuple
    // We'll compute % delta only for job_count and median
    let job_count_change_pct: number | undefined;
    let median_salary_change_pct: number | undefined;

    // If you want to avoid N X Get calls, consider a TimeIndex GSI & batch-get by known PK/SK
    // Here, cheaply do nothing if previous data doesn't exist yet (first run).
    // (Optionally add a small cache map if you expand this.)
    // Skipping read here to keep the first cut simple; add later once table has data.

    const item: TrendItem = {
      skill_canonical: skill.toLowerCase(),
      skill_display: skill,
      region_seniority_mode_period: `${region}#${seniority}#${work_mode}#${periodStr}`,
      region,
      seniority,
      work_mode,
      dimension: AGG_DIM,
      period: periodStr as any,
      period_skill,
      job_count_desc,
      job_count,
      salary_min: p.min as number | undefined,
      salary_max: p.max as number | undefined,
      salary_median: p.p50 as number | undefined,
      salary_p75: p.p75 as number | undefined,
      salary_p95: p.p95 as number | undefined,
      ...(work_mode === "All"
        ? {
            remote_share:
              (remoteCounts.get(
                `${region}|${skill}|${seniority}|All|${periodStr}`
              ) ?? 0) / job_count,
          }
        : {}),
      ...(regional_share != null ? { regional_share } : {}),
      ...(global_share != null ? { global_share } : {}),
      ...(co ? { cooccurring_skills: co } : {}),
      ...(ind ? { industry_distribution: ind } : {}),
      ...(ttl ? { top_titles: ttl } : {}),
      ...(job_count_change_pct != null ? { job_count_change_pct } : {}),
      ...(median_salary_change_pct != null ? { median_salary_change_pct } : {}),
      ...(job_count_change_pct != null
        ? { trend_signal: trendSignal(job_count_change_pct) }
        : {}),
    };
    items.push(item);
  }

  // 4) Write Totals + Trends
  const totalsItems = Object.entries(totals).map(([region, count]) => ({
    period,
    region,
    job_count: count,
  }));
  // --- momentum: look up previous period rows and compute deltas ---
  const prevKeys = items.map((it) => {
    const [region, seniority, work_mode, periodStr] =
      it.region_seniority_mode_period.split("#") as [
        string,
        string,
        string,
        string
      ];
    const prevP = previousPeriod(periodStr);
    return {
      skill: it.skill_canonical,
      sk: makeSK(region, seniority, work_mode, prevP),
    };
  });

  const prevMap = new Map<
    string,
    { job_count?: number; salary_median?: number }
  >();

  for (const batch of chunk(prevKeys, 100)) {
    const res = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [TRENDS_TABLE]: {
            Keys: batch.map((k) => ({
              skill_canonical: k.skill,
              region_seniority_mode_period: k.sk,
            })),
            ProjectionExpression:
              "skill_canonical, region_seniority_mode_period, job_count, salary_median",
          },
        },
      })
    );

    const got = res.Responses?.[TRENDS_TABLE] ?? [];
    for (const r of got) {
      const key = `${r.skill_canonical}|${r.region_seniority_mode_period}`;
      prevMap.set(key, {
        job_count: r.job_count,
        salary_median: r.salary_median,
      });
    }
  }

  // apply deltas to the current items
  for (const it of items) {
    const [region, seniority, work_mode, periodStr] =
      it.region_seniority_mode_period.split("#") as [
        string,
        string,
        string,
        string
      ];

    const prevKey = `${it.skill_canonical}|${makeSK(
      region,
      seniority,
      work_mode,
      previousPeriod(periodStr)
    )}`;
    const prev = prevMap.get(prevKey);

    if (prev) {
      if (typeof prev.job_count === "number" && prev.job_count > 0) {
        it.job_count_change_pct =
          (it.job_count - prev.job_count) / prev.job_count;
        it.trend_signal = trendSignal(it.job_count_change_pct);
      }
      if (
        typeof prev.salary_median === "number" &&
        typeof it.salary_median === "number" &&
        prev.salary_median > 0
      ) {
        it.median_salary_change_pct =
          (it.salary_median - prev.salary_median) / prev.salary_median;
      }
    }
  }
  await batchWriteAll(ddb, TOTALS_TABLE, totalsItems);
  await batchWriteAll(ddb, TRENDS_TABLE, items);

  return { period, postings: postings.length, trendItems: items.length };
};

// helpers
function inc(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1);
}
function push(m: Map<string, number[]>, k: string, v: number) {
  (m.get(k) ?? m.set(k, []).get(k)!).push(v);
}
function add(m: Map<string, Record<string, number>>, k: string, v: string) {
  const row = m.get(k) ?? m.set(k, {}).get(k)!;
  row[v] = (row[v] ?? 0) + 1;
}
function extractStrings(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    if (typeof v[0] === "string") return v as string[];
    if (typeof v[0] === "object" && v[0] && "S" in v[0])
      return (v as any[]).map((x) => x.S).filter(Boolean);
  }
  if (typeof v === "string" && v.startsWith("[")) {
    try {
      return extractStrings(JSON.parse(v));
    } catch {}
  }
  return [];
}
function uniqueRegions(region?: string, country?: string) {
  const out = new Set<string>(["GLOBAL"]);
  if (country) out.add(country);
  if (region && country) out.add(`${country}-${region}`);
  return [...out];
}
function normIndustry(x: string) {
  return x.toLowerCase() === "unknown" ? "Unknown" : title(x);
}
function normSeniority(x: string): Seniority {
  const t = x.toLowerCase();
  if (/intern/.test(t)) return "Intern";
  if (/junior|entry/.test(t)) return "Junior";
  if (/lead/.test(t)) return "Lead";
  if (/principal/.test(t)) return "Principal";
  if (/manager/.test(t)) return "Manager";
  if (/director/.test(t)) return "Director";
  if (/senior|sr/.test(t)) return "Senior";
  if (/mid|intermediate/.test(t)) return "Mid";
  return "Unknown";
}
function normWorkMode(x: string): WorkMode {
  const t = x.toLowerCase();
  if (t.includes("remote")) return "Remote";
  if (t.includes("hybrid")) return "Hybrid";
  return "On-site";
}
function title(s: string) {
  return s.replace(
    /\w\S*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}
