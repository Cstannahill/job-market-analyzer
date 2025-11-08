// preflight.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { buildCorsHeaders } from "./cors.js";

/**
 * Responds only to OPTIONS preflight. Do NOT validate bodies here.
 * Let your real handlers (enqueue/status) handle POST/GET.
 */
export const handlePreflight = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const origin = event.headers.Origin || event.headers.origin;
  const baseHeaders = buildCorsHeaders(origin);

  // Only handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    // Echo requested method/headers if present, otherwise allow a sane set
    const reqMethod =
      event.headers["access-control-request-method"] ??
      event.headers["Access-Control-Request-Method"] ??
      "GET, POST, PUT, DELETE, OPTIONS";

    const reqHeaders =
      event.headers["access-control-request-headers"] ??
      event.headers["Access-Control-Request-Headers"] ??
      "Content-Type, X-Api-Key, Authorization, X-Amz-Date, X-Amz-Security-Token";

    return {
      statusCode: 204,
      headers: {
        ...baseHeaders,
        "Access-Control-Allow-Methods": reqMethod,
        "Access-Control-Allow-Headers": reqHeaders,
        // Keep credentials + vary for proper caching
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      },
      body: "",
    };
  }

  // For any non-OPTIONS requests routed here by mistake, just say "method not allowed".
  return {
    statusCode: 405,
    headers: {
      ...baseHeaders,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    },
    body: "",
  };
};
