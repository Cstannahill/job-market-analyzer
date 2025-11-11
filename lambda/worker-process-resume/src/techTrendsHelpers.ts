import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// ====== utils ======
export function ok(body: any): APIGatewayProxyResult {
  return { statusCode: 200, headers, body: JSON.stringify(body) };
}

export function bad(message: string): APIGatewayProxyResult {
  return { statusCode: 400, headers, body: JSON.stringify({ error: message }) };
}

export function clampInt(v: any, dflt: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

export function requireParam(val: any, name: string): string {
  const s = String(val ?? "").trim();
  if (!s) throw new Error(`Missing required query parameter: ${name}`);
  return s;
}

export function canonical(s: string) {
  return s.trim();
}

export function groupBy<T>(arr: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = key(x);
    const a = m.get(k);
    if (a) a.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function sum<T>(arr: T[], field: keyof T & string): number {
  let t = 0;
  for (const x of arr) {
    const v = (x as any)[field];
    if (typeof v === "number") t += v;
  }
  return t;
}

export function medianOf(nums: number[]) {
  if (!nums.length) return undefined;
  const a = nums.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

/**
 * Calculate weighted median - more accurate for salary aggregations
 * where different segments have different job counts
 */
export function weightedMedian(
  data: Array<{ value: number; weight: number }>
): number | undefined {
  if (!data.length) return undefined;

  // Sort by value
  const sorted = data.slice().sort((a, b) => a.value - b.value);

  // Calculate total weight
  const totalWeight = sorted.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return undefined;

  // Find the median by cumulative weight
  const halfWeight = totalWeight / 2;
  let cumulativeWeight = 0;

  for (const item of sorted) {
    cumulativeWeight += item.weight;
    if (cumulativeWeight >= halfWeight) {
      return item.value;
    }
  }

  // Fallback to last value (shouldn't reach here)
  return sorted[sorted.length - 1].value;
}

export function mostCommon(rows: any[], field: string, n: number) {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    const m = r[field];
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      acc[k] = (acc[k] ?? 0) + (v as number);
    }
  }
  return Object.fromEntries(
    Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
  );
}

export function uniqBy<T>(arr: T[], key: (t: T) => string) {
  const m = new Map<string, T>();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, x);
  }
  return [...m.values()];
}

export function pickPreferredRow(rows: any[]) {
  // prefer All work_mode AND All seniority; if multiple, pick largest job_count
  const allAll = rows.filter(
    (r) => r.work_mode === "All" && r.seniority === "All"
  );
  if (allAll.length) {
    return allAll.sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0))[0];
  }

  // Next prefer All work_mode (any seniority)
  const allMode = rows.filter((r) => r.work_mode === "All");
  if (allMode.length) {
    return allMode.sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0))[0];
  }

  // else pick the largest job_count row
  return rows.sort((a, b) => (b.job_count ?? 0) - (a.job_count ?? 0))[0];
}

export function sumTopMap(
  rows: any[],
  field: "cooccurring_skills" | "industry_distribution" | "top_titles",
  topN: number
) {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const m = r[field];
    if (!m || typeof m !== "object") continue;
    for (const [k, v] of Object.entries(m)) {
      const n = (acc.get(k) ?? 0) + (typeof v === "number" ? v : 0);
      acc.set(k, n);
    }
  }
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, value]) => ({ name, value }));
}
export type Day = `${number}-${string}-${string}`; // YYYY-MM-DD
export type Week = `${number}-W${number}`;
export function toWeek(d: Date): Week {
  // ISO week (Mon-start)
  const dd = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = (dd.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  dd.setUTCDate(dd.getUTCDate() - dayNum + 3); // Thu of this week
  const firstThu = new Date(Date.UTC(dd.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((dd.getTime() - firstThu.getTime()) / 86400000 - 3) / 7);
  return `${dd.getUTCFullYear()}-W${String(week).padStart(2, "0")}` as Week;
}
