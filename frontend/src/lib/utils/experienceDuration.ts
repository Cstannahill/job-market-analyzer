// utils/experienceDuration.ts
const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
} as const;

const SEP = /\s*[-–—]\s*/;

function parseMonthYear(s: string): Date | null {
  const t = s.trim().toLowerCase();

  if (t === "present" || t === "current" || t === "now") {
    return new Date();
  }

  let m = t.match(/^([a-z]+)\s+(\d{4})$/i);
  if (m) {
    const mmKey = m[1].slice(0, 3) as keyof typeof MONTHS;
    const month = MONTHS[mmKey];
    if (month != null) return new Date(Number(m[2]), month, 1);
  }

  m = t.match(/^(\d{4})$/);
  if (m) return new Date(Number(m[1]), 0, 1);

  const dt = new Date(s);
  return isNaN(dt.getTime())
    ? null
    : new Date(dt.getFullYear(), dt.getMonth(), 1);
}

function monthDiff(a: Date, b: Date): number {
  const am = a.getFullYear() * 12 + a.getMonth();
  const bm = b.getFullYear() * 12 + b.getMonth();
  return Math.max(0, bm - am + 1);
}

export type ExperienceItem = {
  duration: string;
  title?: string;
  company?: string;
  location?: string;
  description?: string[];
};

export type ExperienceWithDuration = ExperienceItem & {
  startISO: string | null;
  endISO: string | null;
  durationMonths: number | null;
  durationLabel: string | null;
};

export function enrichExperienceDurations<T extends ExperienceItem>(
  items: T[],
  opts: { emptyMonthCountAs?: number | null } = {}
): ExperienceWithDuration[] {
  const { emptyMonthCountAs = null } = opts;

  return items.map((it) => {
    const raw = (it.duration ?? "").trim();

    const [startRaw, endRaw] = raw.split(SEP);
    const start = parseMonthYear(startRaw || "");
    const end = parseMonthYear(endRaw || "present");

    if (!start || !end) {
      return {
        ...it,
        startISO: null,
        endISO: null,
        durationMonths: emptyMonthCountAs,
        durationLabel:
          emptyMonthCountAs == null
            ? null
            : `${emptyMonthCountAs} ${
                emptyMonthCountAs === 1 ? "month" : "months"
              }`,
      };
    }

    const endClamped = end < start ? start : end;

    const months = monthDiff(start, endClamped);
    return {
      ...it,
      startISO: start.toISOString(),
      endISO: endClamped.toISOString(),
      durationMonths: months,
      durationLabel: `${months} ${months === 1 ? "month" : "months"}`,
    };
  });
}

export function totalMonthsNaive(items: ExperienceWithDuration[]): number {
  return items.reduce((acc, x) => acc + (x.durationMonths ?? 0), 0);
}

export function totalMonthsMerged(items: ExperienceWithDuration[]): number {
  const ranges = items
    .map((x) =>
      x.startISO && x.endISO
        ? ([new Date(x.startISO), new Date(x.endISO)] as const)
        : null
    )
    .filter((r): r is readonly [Date, Date] => !!r)
    .map(
      ([s, e]) =>
        [
          new Date(s.getFullYear(), s.getMonth(), 1),
          new Date(e.getFullYear(), e.getMonth(), 1),
        ] as const
    )
    .sort((a, b) => a[0].getTime() - b[0].getTime());

  const merged: Array<readonly [Date, Date]> = [];
  for (const [s, e] of ranges) {
    if (!merged.length) {
      merged.push([s, e]);
      continue;
    }
    const [ls, le] = merged[merged.length - 1];
    if (s <= new Date(le.getFullYear(), le.getMonth(), 28)) {
      merged[merged.length - 1] = [ls, e > le ? e : le];
    } else {
      merged.push([s, e]);
    }
  }

  return merged.reduce((sum, [s, e]) => sum + monthDiff(s, e), 0);
}
