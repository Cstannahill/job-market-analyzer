// // api-v2/handler.ts
// import type {
//   APIGatewayProxyEvent,
//   APIGatewayProxyResult,
//   APIGatewayProxyEventV2,
//   APIGatewayProxyStructuredResultV2,
// } from "aws-lambda";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   QueryCommand,
//   GetCommand,
//   BatchGetCommand,
// } from "@aws-sdk/lib-dynamodb";
// import {
//   ok,
//   bad,
//   clampInt,
//   requireParam,
//   canonical,
//   groupBy,
//   sum,
//   medianOf,
//   mostCommon,
//   uniqBy,
//   pickPreferredRow,
// } from "./src/utils.js";
// import { getReqId, log, pick, preview, type Ctx } from "./src/logging.js";
// import { pivotModeSeniority } from "./src/pivot.js";
// type ApiEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;
// type ApiResult = APIGatewayProxyResult | APIGatewayProxyStructuredResultV2;

// // ====== ENV ======
// const TRENDS_TABLE = process.env.TRENDS_TABLE || "skill-trends-v2";
// const TOTALS_TABLE = process.env.TOTALS_TABLE || "job-postings-totals";
// const TIME_INDEX = process.env.TIME_INDEX || "TimeIndex"; // PK: period, SK: job_count_desc
// const REGION_INDEX = process.env.REGION_INDEX || "RegionIndex"; // PK: region, SK: period_skill

// const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// // ====== HTTP ======
// const headers = {
//   "Content-Type": "application/json",
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "Content-Type",
//   "Access-Control-Allow-Methods": "GET, OPTIONS",
// };

// export const handler = async (event: ApiEvent): Promise<ApiResult> => {
//   const ctx: Ctx = { rid: getReqId(event) };
//   const method =
//     (event as any).requestContext?.http?.method ||
//     (event as APIGatewayProxyEvent).httpMethod ||
//     "GET";

//   const rawPath =
//     (event as any).rawPath ||
//     (event as any).requestContext?.http?.path ||
//     (event as APIGatewayProxyEvent).path ||
//     "";

//   const path = rawPath.toLowerCase();
//   const query =
//     (event as any).queryStringParameters ||
//     (event as APIGatewayProxyEvent).queryStringParameters ||
//     {};

//   if (method === "OPTIONS") return { statusCode: 200, headers, body: "" };

//   log(ctx, "info", "request", { method, path, query });

//   try {
//     if (path.endsWith("/v2/trends/technologies/top")) {
//       const region = (query.region ?? "US").toUpperCase();
//       const period = requireParam(query.period, "period");
//       const limit = clampInt(query.limit, 20, 1, 100);
//       const data = await getTopTechnologies({ region, period, limit, ctx });
//       log(ctx, "info", "top.done", { count: data.length });
//       return ok({ region, period, count: data.length, data });
//     }

//     if (path.endsWith("/v2/trends/technologies/rising")) {
//       const region = (query.region ?? "US").toUpperCase();
//       const period = requireParam(query.period, "period");
//       const limit = clampInt(query.limit, 20, 1, 100);
//       const data = await getRisingTechnologies({ region, period, limit, ctx });
//       log(ctx, "info", "rising.done", { count: data.length });
//       return ok({ region, period, count: data.length, data });
//     }

//     if (path.includes("/v2/trends/technology/")) {
//       const name = decodeURIComponent(
//         path.split("/v2/trends/technology/")[1] || ""
//       ).trim();
//       if (!name) return bad("Missing technology name in path");
//       const region = (query.region ?? "US").toUpperCase();
//       const period = requireParam(query.period, "period");
//       const data = await getTechnologyDetail({
//         tech: name,
//         region,
//         period,
//         ctx,
//       });
//       log(ctx, "info", "detail.done", {
//         tech: name,
//         slices: {
//           work_mode: data.by_work_mode?.length ?? 0,
//           seniority: data.by_seniority?.length ?? 0,
//         },
//       });
//       return ok({ technology: name, region, period, ...data });
//     }

//     if (path.endsWith("/v2/trends/overview")) {
//       const region = (query.region ?? "US").toUpperCase();
//       const period = requireParam(query.period, "period");
//       const limit = clampInt(query.limit, 10, 1, 50);
//       const data = await getOverview({ region, period, limit, ctx });
//       log(ctx, "info", "overview.done", {
//         total_postings: data.total_postings,
//         topLen: data.top_technologies.length,
//       });
//       return ok({ region, period, ...data });
//     }

//     return bad("Invalid endpoint");
//   } catch (err: any) {
//     log(ctx, "error", "unhandled", { error: err?.message, stack: err?.stack });
//     return {
//       statusCode: 500,
//       headers,
//       body: JSON.stringify({
//         error: "Internal server error",
//         message: err?.message || String(err),
//       }),
//     };
//   }
// };

// // ====== Routes ======

// /**
//  * Top technologies for a period in a region.
//  * Query TimeIndex (PK=period) sorted by job_count_desc, filter region in-memory, slice.
//  */
// async function getTopTechnologies(opts: {
//   region: string;
//   period: string;
//   limit: number;
//   ctx?: { rid: string };
// }) {
//   const { region, period, limit, ctx } = opts;

//   const pageSize = Math.max(limit * 5, 100);
//   log(ctx, "debug", "top.query-gsi.start", {
//     period,
//     pageSize,
//     index: TIME_INDEX,
//   });

//   const q = await dynamo.send(
//     new QueryCommand({
//       TableName: TRENDS_TABLE,
//       IndexName: TIME_INDEX,
//       KeyConditionExpression: "#p = :period",
//       ExpressionAttributeNames: { "#p": "period" },
//       ExpressionAttributeValues: { ":period": period },
//       ProjectionExpression:
//         "skill_canonical, region_seniority_mode_period, #p, job_count_desc",
//       ScanIndexForward: false,
//       Limit: pageSize,
//     })
//   );

//   const keys = (q.Items ?? []).map((it) => ({
//     skill_canonical: it.skill_canonical,
//     region_seniority_mode_period: it.region_seniority_mode_period,
//   }));
//   log(ctx, "debug", "top.query-gsi.done", {
//     gsiCount: q.Count,
//     keys: keys.length,
//     preview: preview(q.Items ?? [], [
//       "skill_canonical",
//       "region_seniority_mode_period",
//       "job_count_desc",
//     ]),
//   });

//   if (!keys.length) return [];

//   // BatchGet base items
//   const batches: any[] = [];
//   for (let i = 0; i < keys.length; i += 100) {
//     const slice = keys.slice(i, i + 100);
//     log(ctx, "debug", "top.batchget.start", {
//       batch: `${i}-${i + slice.length}`,
//     });

//     const resp = await dynamo.send(
//       new BatchGetCommand({
//         RequestItems: {
//           [TRENDS_TABLE]: {
//             Keys: slice.map((k) => ({
//               skill_canonical: k.skill_canonical,
//               region_seniority_mode_period: k.region_seniority_mode_period,
//             })),
//             ExpressionAttributeNames: { "#r": "region" },
//             ProjectionExpression: [
//               "skill_canonical",
//               "#r",
//               "seniority",
//               "work_mode",
//               "period",
//               "job_count",
//               "regional_share",
//               "global_share",
//               "salary_median",
//               "salary_p75",
//               "salary_p95",
//               "trend_signal",
//               "job_count_change_pct",
//               "cooccurring_skills",
//               "industry_distribution",
//               "top_titles",
//             ].join(", "),
//           },
//         },
//       })
//     );

//     const got = resp.Responses?.[TRENDS_TABLE] ?? [];
//     log(ctx, "debug", "top.batchget.done", {
//       got: got.length,
//       preview: preview(got, [
//         "skill_canonical",
//         "region",
//         "work_mode",
//         "job_count",
//         "salary_median",
//       ]),
//     });
//     batches.push(...got);
//   }

//   const regionRows = batches.filter(
//     (x) => String(x.region).toUpperCase() === region
//   );
//   if (!regionRows.length) {
//     log(ctx, "warn", "top.no-rows-for-region", {
//       region,
//       have: batches.length,
//       sample: preview(batches, ["region", "work_mode", "skill_canonical"]),
//     });
//   } else {
//     const allRows = regionRows.filter((r) => r.work_mode === "All");
//     log(ctx, "debug", "top.filter", {
//       regionRows: regionRows.length,
//       allRows: allRows.length,
//     });
//   }

//   // group by tech and choose representative row
//   const byTechMap = new Map<string, any[]>();
//   for (const r of regionRows) {
//     const k = r.skill_canonical;
//     if (!byTechMap.has(k)) byTechMap.set(k, []);
//     byTechMap.get(k)!.push(r);
//   }

//   const picked: any[] = [];
//   for (const [tech, list] of byTechMap) {
//     const chosen = pickPreferredRow(list);
//     if (!chosen) {
//       log(ctx, "warn", "top.pickPreferredRow.none", {
//         tech,
//         listLen: list.length,
//       });
//       continue;
//     }
//     // log if chosen lacks salaries
//     if (chosen.salary_median == null) {
//       log(ctx, "debug", "top.picked.no-salary", {
//         tech,
//         work_mode: chosen.work_mode,
//         job_count: chosen.job_count,
//       });
//     }
//     picked.push(chosen);
//   }

//   picked.sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0));
//   const out = picked.slice(0, limit);
//   log(ctx, "info", "top.out", {
//     outLen: out.length,
//     preview: preview(out, [
//       "skill_canonical",
//       "work_mode",
//       "job_count",
//       "salary_median",
//       "regional_share",
//     ]),
//   });
//   return out;
// }

// /**
//  * Rising technologies: same base as top(), but filter by trend_signal and sort by job_count_change_pct desc.
//  */
// async function getRisingTechnologies(opts: {
//   region: string;
//   period: string;
//   limit: number;
//   ctx?: { rid: string };
// }) {
//   const { region, period, limit, ctx } = opts;
//   const base = await getTopTechnologies({
//     region,
//     period,
//     limit: Math.max(limit * 5, 60),
//     ctx,
//   });

//   const rising = base
//     .filter(
//       (x) =>
//         x.trend_signal === "rising" &&
//         typeof x.job_count_change_pct === "number"
//     )
//     .sort(
//       (a, b) => (b.job_count_change_pct ?? 0) - (a.job_count_change_pct ?? 0)
//     )
//     .slice(0, limit);

//   log(ctx, "info", "rising.out", {
//     baseLen: base.length,
//     risingLen: rising.length,
//     preview: preview(rising, [
//       "skill_canonical",
//       "job_count_change_pct",
//       "job_count",
//     ]),
//   });
//   return rising;
// }

// /**
//  * Technology detail breakdown for a region & period.
//  * - Query PK=skill_canonical, then filter: region match AND period match.
//  * - Return slices (work_mode, seniority), salary percentiles, co-occur, industries, titles.
//  */
// async function getTechnologyDetail(opts: {
//   tech: string;
//   region: string;
//   period: string;
//   ctx?: { rid: string };
// }) {
//   const { tech, region, period, ctx } = opts;

//   log(ctx, "debug", "detail.query.start", {
//     tech: canonical(tech),
//     region,
//     period,
//   });

//   const res = await dynamo.send(
//     new QueryCommand({
//       TableName: TRENDS_TABLE,
//       KeyConditionExpression: "#pk = :skill",
//       ExpressionAttributeNames: { "#pk": "skill_canonical" },
//       ExpressionAttributeValues: { ":skill": canonical(tech) },
//     })
//   );

//   const rows = (res.Items ?? []).filter(
//     (x) =>
//       String(x.region).toUpperCase() === region && String(x.period) === period
//   );
//   const pivot = pivotModeSeniority(rows);

//   const by_work_mode = pivot.table.map((r) => ({
//     work_mode: r.work_mode,
//     job_count: r.row_total.job_count,
//     salary_median: r.row_total.salary_median,
//   }));

//   log(ctx, "debug", "detail.rows", {
//     total: res.Count,
//     afterFilter: rows.length,
//     preview: preview(rows, [
//       "skill_canonical",
//       "region",
//       "period",
//       "work_mode",
//       "job_count",
//       "salary_median",
//     ]),
//   });

//   let summary = rows.find((r) => r.work_mode === "All") ?? null;
//   if (!summary && rows.length) {
//     log(ctx, "warn", "detail.no-all-row", {
//       tech,
//       haveModes: [...new Set(rows.map((r) => r.work_mode))],
//     });
//     summary = synthesizeSummary(rows);
//     log(ctx, "debug", "detail.synthesized", {
//       summary: pick(summary, [
//         "work_mode",
//         "job_count",
//         "salary_median",
//         "regional_share",
//       ]),
//     });
//   }

//   const modes = rows.filter((r) => r.work_mode !== "All");
//   const bySeniority = groupBy(rows, (r) => r.seniority);
//   const seniority = [...bySeniority.entries()].map(([level, list]) => ({
//     level,
//     job_count: sum(list, "job_count"),
//     salary_median: medianOf(
//       list.map((r) => r.salary_median).filter((n) => typeof n === "number")
//     ),
//   }));

//   log(ctx, "info", "detail.out", {
//     tech,
//     rows: rows.length,
//     hasSummary: !!summary,
//     modes: modes.length,
//     seniority: seniority.length,
//   });

//   return {
//     summary,
//     by_work_mode: modes.map((r) => ({
//       work_mode: r.work_mode,
//       job_count: r.job_count,
//       salary_median: r.salary_median,
//       regional_share: r.regional_share,
//       global_share: r.global_share,
//     })),
//     by_seniority: seniority,
//     cooccurring_skills:
//       summary?.cooccurring_skills ?? mostCommon(rows, "cooccurring_skills", 10),
//     industry_distribution:
//       summary?.industry_distribution ??
//       mostCommon(rows, "industry_distribution", 10),
//     top_titles: summary?.top_titles ?? mostCommon(rows, "top_titles", 5),
//   };
// }

// /**
//  * Overview: totals + the head of the period for quick dashboard header.
//  */
// function synthesizeSummary(rows: any) {
//   // Aggregate counts
//   const job_count = rows.reduce(
//     (t: number, r: any) => t + (r.job_count ?? 0),
//     0
//   );

//   // Remote share: weighted by job_count across modes if we have mode tags
//   // If you only have Remote rows explicitly, you can compute: remote = sum(Remote.job_count)/total
//   const total = job_count || 1;
//   const remoteCount = rows
//     .filter((r: any) => r.work_mode === "Remote")
//     .reduce((t: number, r: any) => t + (r.job_count ?? 0), 0);
//   const remote_share = remoteCount / total;

//   // Salaries: take median of medians as a stable fallback
//   const medians = rows
//     .map((r: any) => r.salary_median)
//     .filter((n: any) => typeof n === "number");
//   const salary_median = medianOf(medians);
//   const p75s = rows
//     .map((r: any) => r.salary_p75)
//     .filter((n: any) => typeof n === "number");
//   const salary_p75 = medianOf(p75s);
//   const p95s = rows
//     .map((r: any) => r.salary_p95)
//     .filter((n: any) => typeof n === "number");
//   const salary_p95 = medianOf(p95s);

//   // Shares: take max or mean; mean is less jumpy
//   const regionalVals = rows
//     .map((r: any) => r.regional_share)
//     .filter((n: any) => typeof n === "number");
//   const globalVals = rows
//     .map((r: any) => r.global_share)
//     .filter((n: any) => typeof n === "number");
//   const regional_share = regionalVals.length
//     ? regionalVals.reduce((a: any, b: any) => a + b, 0) / regionalVals.length
//     : undefined;
//   const global_share = globalVals.length
//     ? globalVals.reduce((a: any, b: any) => a + b, 0) / globalVals.length
//     : undefined;

//   // Co-occurrence / industries / titles: merge the maps
//   const cooccurring_skills = mostCommon(rows, "cooccurring_skills", 15);
//   const industry_distribution = mostCommon(rows, "industry_distribution", 15);
//   const top_titles = mostCommon(rows, "top_titles", 10);

//   // Carry basic identity fields from the first row
//   const base = rows[0];

//   return {
//     ...base,
//     work_mode: "All",
//     job_count,
//     remote_share,
//     salary_median,
//     salary_p75,
//     salary_p95,
//     regional_share,
//     global_share,
//     cooccurring_skills,
//     industry_distribution,
//     top_titles,
//   };
// }

// async function getOverview(opts: {
//   region: string;
//   period: string;
//   limit: number;
//   ctx?: Ctx; // make optional
// }) {
//   const { region, period, limit, ctx } = opts;

//   log(ctx, "debug", "overview.start", { region, period, limit });

//   const totals = await dynamo.send(
//     new GetCommand({
//       TableName: TOTALS_TABLE,
//       Key: { period, region },
//     })
//   );
//   const total_postings = totals.Item?.job_count ?? 0;

//   log(ctx, "debug", "overview.totals", {
//     hasItem: !!totals.Item,
//     job_count: total_postings,
//   });

//   // pass ctx to keep logs correlated
//   const top = await getTopTechnologies({ region, period, limit, ctx });

//   const remote_share_est = (() => {
//     const allRow = top.find((x) => x.work_mode === "All");
//     return allRow?.remote_share ?? undefined;
//   })();

//   const out = {
//     total_postings,
//     remote_share: remote_share_est,
//     top_technologies: top,
//   };

//   log(ctx, "info", "overview.out", {
//     total_postings,
//     topLen: top.length,
//     preview: top.slice(0, 3).map((t) => ({
//       tech: t.skill_canonical,
//       mode: t.work_mode,
//       count: t.job_count,
//       p50: t.salary_median,
//     })),
//   });

//   return out;
// }
