import type { WorkMode, Seniority } from "@job-market-analyzer/types/trendsv2";

export function pivotToMatrix(
  modes: {
    work_mode: WorkMode;
    job_count: number;
    salary_median?: number;
    seniority?: Seniority | string;
  }[],
  seniors: {
    level: Seniority | string;
    job_count: number;
    salary_median?: number;
  }[]
) {
  const columns: Seniority[] = ["Junior", "Mid", "Senior", "Lead"];
  const rows: WorkMode[] = ["Remote", "Hybrid", "On-site"];

  const cell = new Map<string, { count: number; p50?: number }>();
  const byLevel = new Map<
    Seniority | string,
    { count: number; p50?: number }
  >();
  for (const s of seniors)
    byLevel.set(s.level, { count: s.job_count, p50: s.salary_median });

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
