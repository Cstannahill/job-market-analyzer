// get-user-resumes.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { buildCorsHeaders } from "./cors.js"; // your helper (ESM path) ← uses allowed origins

// ----------------------
// Config (adjust as needed)
// ----------------------
const CONFIG = {
  TABLE_NAME: process.env.RESUMES_TABLE ?? "Resumes",
  // GSI where partition key is userId (e.g., GSI1PK = userId). Rename if your index differs.
  USERID_GSI_NAME: process.env.USERID_GSI_NAME ?? "GSI_ByUserId",
  USERID_GSI_PK: process.env.USERID_GSI_PK ?? "PK",
  // Optional: page size cap for safety
  DEFAULT_LIMIT: Number(process.env.DEFAULT_LIMIT ?? "5"),
};

const ddb = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

type GetUserResumesRequestBody = {
  userId?: string;
  limit?: number;
  nextToken?: string; // serialized LastEvaluatedKey
};

type ResumeItem = Record<string, unknown>; // Narrow if you have a schema

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const origin = event.headers.Origin || event.headers.origin;
  const headers = buildCorsHeaders(origin); // CORS via your helper  ← :contentReference[oaicite:2]{index=2}

  // Fast path for preflight (you can instead delegate to your handlePreflight helper)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Only allow POST for this resource
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // Parse and validate body
  const body = parseJson<GetUserResumesRequestBody>(event.body);
  const userId = body?.userId?.trim();

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing or empty 'userId' in body" }),
    };
  }

  const limit =
    typeof body?.limit === "number" && body.limit > 0 && body.limit <= 200
      ? body.limit
      : CONFIG.DEFAULT_LIMIT;

  // Optional pagination
  let exclusiveStartKey: Record<string, unknown> | undefined;
  if (body?.nextToken) {
    try {
      exclusiveStartKey = JSON.parse(
        Buffer.from(body.nextToken, "base64").toString("utf-8")
      );
    } catch {
      // ignore bad token; start from beginning
    }
  }

  // Build query against the userId GSI
  const queryInput: QueryCommandInput = {
    TableName: CONFIG.TABLE_NAME,
    IndexName: CONFIG.USERID_GSI_NAME,
    KeyConditionExpression: "#pk = :v",
    ExpressionAttributeNames: { "#pk": CONFIG.USERID_GSI_PK },
    ExpressionAttributeValues: { ":v": userId },
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey,
    // Uncomment if you want newest first and you use a sort key (e.g., createdAt)
    // ScanIndexForward: false,
  };

  try {
    const resp = await doc.send(new QueryCommand(queryInput));

    const items = (resp.Items ?? []) as ResumeItem[];
    const nextToken = resp.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(resp.LastEvaluatedKey), "utf-8").toString(
          "base64"
        )
      : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "success",
        count: items.length,
        items,
        nextToken,
      }),
    };
  } catch (error) {
    console.error("DynamoDB query error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown server error",
      }),
    };
  }
};
