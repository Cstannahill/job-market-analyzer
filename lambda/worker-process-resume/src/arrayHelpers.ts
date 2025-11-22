import type { EnrichedSkillData } from "./types.js";

export type TechStat = {
  technology: string;
  job_count?: number;
  [k: string]: any;
};

export function topByJobCount(
  items: EnrichedSkillData[],
  x: number
): EnrichedSkillData[] {
  if (!Array.isArray(items) || x <= 0) return [];
  const toNum = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;

  return [...items]
    .sort((a, b) => toNum(b.job_count) - toNum(a.job_count))
    .slice(0, x);
}
