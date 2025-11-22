export type Day = `${number}-${string}-${string}`;
export type Week = `${number}-W${number}`;

export function toDay(d: Date): Day {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toWeek(d: Date): Week {
  const dd = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = (dd.getUTCDay() + 6) % 7;
  dd.setUTCDate(dd.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(dd.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((dd.getTime() - firstThu.getTime()) / 86400000 - 3) / 7);
  return `${dd.getUTCFullYear()}-W${String(week).padStart(2, "0")}` as Week;
}

export function weekDates(week: Week): Day[] {
  const [yStr, wStr] = week.split("-W");
  const y = Number(yStr),
    w = Number(wStr);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dayOfWeek = (jan4.getUTCDay() + 6) % 7; // Mon=0
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + (w - 1) * 7);
  const out: Day[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    out.push(toDay(d));
  }
  return out;
}
