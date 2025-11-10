// normalizers/salary.ts
export function parseSalaryRange(raw: string, mentioned: boolean) {
  if (!mentioned) return null;
  const s = raw.replace(/[, ]/g, "").toLowerCase();

  // detect hourly/day vs annual
  const isHourly = /\/?hr|hour/.test(s);
  const isDay = /day/.test(s);

  // extract numbers & 'k'
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)(k)?/g)].map((m) => {
    const n = parseFloat(m[1]);
    return m[2] ? n * 1000 : n;
  });
  if (nums.length === 0) return null;

  // choose min/max
  const min = Math.min(...nums),
    max = Math.max(...nums);
  let annualUSD = (min + max) / 2;

  if (isHourly) annualUSD *= 2080;
  if (isDay) annualUSD *= 260;

  // clamp obviously wrong values
  if (annualUSD < 20000 || annualUSD > 1000000) return null;
  return { min, max, annualUSD };
}

export function percentiles(values: number[]) {
  if (!values.length) return {};
  const a = [...values].sort((x, y) => x - y);
  const pick = (p: number) =>
    a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))];
  return {
    min: a[0],
    max: a[a.length - 1],
    p50: pick(0.5),
    p75: pick(0.75),
    p95: pick(0.95),
  };
}
