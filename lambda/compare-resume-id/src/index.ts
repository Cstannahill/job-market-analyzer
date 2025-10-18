import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { processFile } from "./fileProcessor.js";
import { handlePreflight } from "./preflight.js";
import { getS3Object } from "./s3Service.js";

// === MAIN HANDLER ===
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { statusCode, headers, body } = await handlePreflight(event);

  // If preflight/early handler returned non-200 (e.g. OPTIONS -> 204),
  // return immediately so we don't try to parse an empty body.
  if (statusCode !== 200) {
    return { statusCode, headers, body };
  }

  let decodedKey: string;
  try {
    const parsed = JSON.parse(body || "{}");
    decodedKey = parsed.id;
    if (!decodedKey) throw new Error("Missing id in body");
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid or missing id" }),
    };
  }
  try {
    const analysis = await processFile(decodedKey);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "complete",
        analysis: analysis,
      }),
    };
  } catch (err: any) {
    if (err.name === "NoSuchKey") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: "processing" }),
      };
    }
    console.error("S3 error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: "failed",
        error: "Error retrieving analysis status",
      }),
    };
  }
};
