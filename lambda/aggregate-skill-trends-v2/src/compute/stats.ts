export function zeroPad(n: number, width = 6) {
  return String(n).padStart(width, "0");
}

export function topN(map: Record<string, number> | undefined, n = 10) {
  if (!map) return undefined;
  const entries = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
  return Object.fromEntries(entries);
}

export function sum(map: Record<string, number> | undefined) {
  if (!map) return 0;
  return Object.values(map).reduce((a, b) => a + b, 0);
}
