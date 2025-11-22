export function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function makeSK(
  region: string,
  seniority: string,
  work_mode: string,
  period: string
) {
  return `${region}#${seniority}#${work_mode}#${period}`;
}
export function previousPeriod(p: string) {
  if (/^\d{4}-W\d{2}$/.test(p)) {
    const [y, w] = p.split("-W").map(Number);
    if (w > 1) return `${y}-W${String(w - 1).padStart(2, "0")}`;

    const last = lastIsoWeekOfYear(y - 1);
    return `${y - 1}-W${String(last).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const d = new Date(p + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return p;
}

function lastIsoWeekOfYear(y: number) {
  const d = new Date(Date.UTC(y, 11, 31));

  const day = d.getUTCDay();
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() - ((day + 6) % 7) + 3);
  const firstThu = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4));
  return (
    1 + Math.round(((thu.getTime() - firstThu.getTime()) / 86400000 - 3) / 7)
  );
}

export function trendSignal(deltaPct: number): "rising" | "falling" | "steady" {
  if (deltaPct >= 0.2) return "rising";
  if (deltaPct <= -0.2) return "falling";
  return "steady";
}
