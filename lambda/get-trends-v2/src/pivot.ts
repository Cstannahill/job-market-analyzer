type Mode = "Remote" | "Hybrid" | "On-site" | "All";
type PivotMode = Exclude<Mode, "All">;

type Seniority = "Junior" | "Mid" | "Senior" | "Lead" | "Unknown";

export function pivotModeSeniority(rows: any[]) {
  const modes: PivotMode[] = ["Remote", "Hybrid", "On-site"];
  const levels: Seniority[] = ["Junior", "Mid", "Senior", "Lead", "Unknown"];

  const cell = new Map<string, { job_count: number; salaries: number[] }>();
  const keyOf = (m: Mode, s: Seniority) => `${m}|${s}`;

  for (const r of rows) {
    const m = r.work_mode as Mode;
    const s = (r.seniority ?? "Unknown") as Seniority;
    if (!m || m === "All") continue;

    const k = keyOf(m, s);
    const c = cell.get(k) ?? { job_count: 0, salaries: [] };
    c.job_count += r.job_count ?? 0;
    if (typeof r.salary_median === "number") c.salaries.push(r.salary_median);
    cell.set(k, c);
  }

  const median = (xs: number[]) => {
    if (!xs.length) return undefined;
    const a = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  };

  const rowTotals: Record<
    PivotMode,
    { job_count: number; salary_median?: number }
  > = {
    Remote: { job_count: 0 },
    Hybrid: { job_count: 0 },
    "On-site": { job_count: 0 },
  };
  const colTotals: Record<
    Seniority,
    { job_count: number; salary_median?: number }
  > = {
    Junior: { job_count: 0 },
    Mid: { job_count: 0 },
    Senior: { job_count: 0 },
    Lead: { job_count: 0 },
    Unknown: { job_count: 0 },
  };

  const table: Array<{
    work_mode: Mode;
    cells: Array<{
      seniority: Seniority;
      job_count: number;
      salary_median?: number;
    }>;
    row_total: { job_count: number; salary_median?: number };
  }> = [];

  for (const m of modes) {
    const cells = levels.map((s) => {
      const c = cell.get(`${m}|${s}`) ?? { job_count: 0, salaries: [] };
      const smed = median(c.salaries);
      rowTotals[m].job_count += c.job_count;
      if (smed != null)
        ((rowTotals[m] as any)._s ??= []), (rowTotals[m] as any)._s.push(smed);
      colTotals[s].job_count += c.job_count;
      if (smed != null)
        ((colTotals[s] as any)._s ??= []), (colTotals[s] as any)._s.push(smed);
      return { seniority: s, job_count: c.job_count, salary_median: smed };
    });
    const rt = rowTotals[m] as any;
    table.push({
      work_mode: m,
      cells,
      row_total: {
        job_count: rowTotals[m].job_count,
        salary_median: median(rt._s ?? []),
      },
    });
  }

  const col_totals = Object.fromEntries(
    levels.map((s) => {
      const ct = colTotals[s] as any;
      return [
        s,
        {
          job_count: colTotals[s].job_count,
          salary_median: median(ct._s ?? []),
        },
      ];
    })
  );

  return { modes, levels, table, row_totals: rowTotals, col_totals };
}
