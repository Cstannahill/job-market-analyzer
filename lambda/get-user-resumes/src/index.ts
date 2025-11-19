// get-user-resumes.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { buildCorsHeaders } from "./cors.js"; // your helper (ESM path) ← uses allowed origins
import { coerceInsights } from "./utils.js";
import type { ResumeRecord } from "@job-market-analyzer/types/resume-record";

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

// Narrow if you have a schema

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
  const method = event.httpMethod || event.requestContext.httpMethod;
  const origin = event.headers.Origin || event.headers.origin;
  const headers = buildCorsHeaders(origin);
  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };

  let userId: string | undefined;

  if (method === "GET") {
    userId = event.pathParameters?.userId?.trim();
  } else if (method === "POST") {
    const body = event.body ? JSON.parse(event.body) : {};
    userId = body.userId?.trim();
  } else {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing 'userId'" }),
    };
  }

  // CORS via your helper  ← :contentReference[oaicite:2]{index=2}

  // Build query against the userId GSI
  const pk = `USER#${userId}`;

  const queryInput: QueryCommandInput = {
    TableName: CONFIG.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
    ExpressionAttributeNames: {
      "#pk": "PK",
      "#sk": "SK",
    },
    ExpressionAttributeValues: {
      ":pk": pk,
      ":sk": "RESUME#",
    },
    // ScanIndexForward: false, // newest first if SK encodes time
  };
  console.log(queryInput);
  try {
    const resp = await doc.send(new QueryCommand(queryInput));

    const items: ResumeRecord[] = (resp.Items ?? []).map(
      (it: Record<string, any>) => {
        const parsed = coerceInsights(it.insightsText);
        if (parsed !== undefined) {
          const { insightsText, ...rest } = it;
          return { ...rest, insights: parsed } as ResumeRecord;
        }
        return it as ResumeRecord;
      }
    );
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





