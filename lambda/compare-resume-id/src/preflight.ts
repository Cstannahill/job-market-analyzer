import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { buildCorsHeaders } from "./cors.js";

export const handlePreflight = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const origin = event.headers.Origin || event.headers.origin;
  const baseHeaders = buildCorsHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
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

        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      },
      body: "",
    };
  }

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
