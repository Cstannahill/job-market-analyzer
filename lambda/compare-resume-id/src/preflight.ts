import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { buildCorsHeaders } from "./cors";

export const handlePreflight = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const origin = event.headers.Origin || event.headers.origin || null;
  const headers = buildCorsHeaders(origin);
  let decodedKey: string = "ID not processed";
  // Handle OPTIONS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // GET /resumes/compare/{id}
  if (event.httpMethod === "GET") {
    try {
      const id = event.pathParameters?.id;
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing id parameter" }),
        };
      }

      decodedKey = decodeURIComponent(id);
    } catch (error) {
      console.error("Process error:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: "success",
      id: decodedKey,
    }),
  };
};
