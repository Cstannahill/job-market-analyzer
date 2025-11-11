export type Day = `${number}-${string}-${string}`; // YYYY-MM-DD
export type Week = `${number}-W${number}`;
export function toWeek(d: Date): Week {
  // ISO week (Mon-start)
  const dd = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = (dd.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  dd.setUTCDate(dd.getUTCDate() - dayNum + 3); // Thu of this week
  const firstThu = new Date(Date.UTC(dd.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((dd.getTime() - firstThu.getTime()) / 86400000 - 3) / 7);
  return `${dd.getUTCFullYear()}-W${String(week).padStart(2, "0")}` as Week;
}
