const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://xee5kjisf5.execute-api.us-east-1.amazonaws.com/prod",
];

export function buildCorsHeaders(origin?: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS, POST, PUT",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
