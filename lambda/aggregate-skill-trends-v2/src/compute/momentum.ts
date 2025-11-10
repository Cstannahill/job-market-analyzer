export function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Build the exact SK we store (re-usable)
export function makeSK(
  region: string,
  seniority: string,
  work_mode: string,
  period: string
) {
  return `${region}#${seniority}#${work_mode}#${period}`;
}
export function previousPeriod(p: string) {
  // "YYYY-W##" or "YYYY-MM-DD"
  if (/^\d{4}-W\d{2}$/.test(p)) {
    const [y, w] = p.split("-W").map(Number);
    if (w > 1) return `${y}-W${String(w - 1).padStart(2, "0")}`;
    // week 1 -> last ISO week of previous year
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
  // ISO week 52 or 53
  const d = new Date(Date.UTC(y, 11, 31));
  // Thursday belongs to its week’s year
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
