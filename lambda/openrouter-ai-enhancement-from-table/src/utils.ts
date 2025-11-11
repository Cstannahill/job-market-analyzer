// Hard cap fields to reduce tokens / content-length; adjust as needed
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

export const now = () => Date.now(); // always number

export const dt = (start: number) => Date.now() - start; // always number

export const dtStr = (start: number) => `${dt(start)}ms`; // always string

export const keyCooldowns: Record<string, number> = {}; // key -> timestamp when usable again
