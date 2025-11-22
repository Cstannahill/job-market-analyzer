export function truncate(s: string | undefined, max = 4000) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max) : s;
}

export function safeString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const nowMs = () => Date.now();

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const now = () => Date.now();

export const dt = (start: number) => Date.now() - start;

export const dtStr = (start: number) => `${dt(start)}ms`;

export const keyCooldowns: Record<string, number> = {};

export function yyyymmdd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
