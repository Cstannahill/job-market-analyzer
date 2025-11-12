type TechStat = {
  technology: string;
  job_count?: number; // some items may not have it
  [k: string]: any;
};

export function topByJobCount(items: TechStat[], x: number): TechStat[] {
  if (!Array.isArray(items) || x <= 0) return [];
  const toNum = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;

  return [...items]
    .sort((a, b) => toNum(b.job_count) - toNum(a.job_count))
    .slice(0, x);
}
