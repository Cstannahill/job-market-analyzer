const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://main.d2qk81z2cubp0y.amplifyapp.com",
];

export function buildCorsHeaders(origin?: string) {
  const effectiveOrigin = origin ?? ALLOWED_ORIGINS[0]; // default if undefined
  const allowedOrigin = ALLOWED_ORIGINS.includes(effectiveOrigin)
    ? effectiveOrigin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "Content-Type, X-Api-Key, Authorization, X-Amz-Date, X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}
