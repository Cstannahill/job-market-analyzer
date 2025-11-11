type LogLevel = "debug" | "info" | "warn" | "error";
export type Ctx = { rid: string };
const LOG_LEVEL = (process.env.LOG_LEVEL ?? "debug") as LogLevel;

export function shouldLog(level: LogLevel): boolean {
  const order: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };
  return order[level] >= order[LOG_LEVEL];
}

export function pick<T extends Record<string, any>>(
  o: T | null | undefined,
  keys: (keyof T)[]
) {
  const out: Partial<T> = {};
  if (!o) return out;
  for (const k of keys) if (k in o) (out as any)[k] = (o as any)[k];
  return out;
}

export function preview(items: any[] = [], fields: string[] = [], n = 3) {
  return items.slice(0, n).map((x) => {
    const y: Record<string, any> = {};
    for (const f of fields) y[f] = x?.[f];
    return y;
  });
}

export function log(
  ctx: Ctx | undefined,
  level: LogLevel,
  msg: string,
  extra?: unknown
) {
  if (!shouldLog(level)) return;
  const line: any = {
    level,
    rid: ctx?.rid ?? "n/a",
    msg,
    t: new Date().toISOString(),
  };
  if (extra !== undefined) line.extra = extra;
  (console as any)[level === "debug" ? "log" : level](JSON.stringify(line));
}

export function getReqId(event: any): string {
  return (
    event?.requestContext?.requestId ||
    event?.requestContext?.requestId?.toString?.() ||
    Math.random().toString(36).slice(2)
  );
}
