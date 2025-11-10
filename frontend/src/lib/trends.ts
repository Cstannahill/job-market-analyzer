// helpers (at top of file, after imports)
type Mode = "All" | "Remote" | "Hybrid" | "On-site";
type Level = "Junior" | "Mid" | "Senior" | "Lead" | "Unknown" | string;

export function pivotToMatrix(
  modes: {
    work_mode: Mode;
    job_count: number;
    salary_median?: number;
    seniority?: Level;
  }[],
  seniors: { level: Level; job_count: number; salary_median?: number }[]
) {
  // Normalize the set of columns (seniority levels) you want to show
  const columns: Level[] = ["Junior", "Mid", "Senior", "Lead"];
  const rows: Mode[] = ["Remote", "Hybrid", "On-site"];

  // Build lookup: (mode, level) -> {count, p50}
  const cell = new Map<string, { count: number; p50?: number }>();
  // If your API doesn't give per-(mode,level) rows, fall back to by_level for totals
  const byLevel = new Map<Level, { count: number; p50?: number }>();
  for (const s of seniors)
    byLevel.set(s.level, { count: s.job_count, p50: s.salary_median });

  // If your API only provides mode slices aggregated across levels,
  // we still want to show reasonable numbers; distribute counts proportionally
  const totalByLevel = seniors.reduce((a, s) => a + (s.job_count ?? 0), 0) || 1;
  for (const r of rows) {
    const modeRec = modes.find((m) => m.work_mode === r);
    const modeCount = modeRec?.job_count ?? 0;
    for (const c of columns) {
      const share = (byLevel.get(c)?.count ?? 0) / totalByLevel;
      const estCount = Math.round(modeCount * share);
      const k = `${r}|${c}`;
      cell.set(k, { count: estCount, p50: modeRec?.salary_median });
    }
  }

  return { rows, columns, cell };
}
