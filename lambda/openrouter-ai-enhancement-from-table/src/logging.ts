const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase(); // "debug" | "info" | "warn" | "error"

export function logDebug(...a: any[]) {
  if (LOG_LEVEL === "debug") console.log("[DEBUG]", ...a);
}
export function logInfo(...a: any[]) {
  if (LOG_LEVEL === "debug" || LOG_LEVEL === "info")
    console.log("[INFO]", ...a);
}
export function logWarn(...a: any[]) {
  if (LOG_LEVEL !== "error") console.warn("[WARN]", ...a);
}
export function logError(...a: any[]) {
  console.error("[ERROR]", ...a);
}
