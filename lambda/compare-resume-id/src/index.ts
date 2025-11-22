import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { v4 as uuid } from "uuid";
import { buildCorsHeaders } from "./cors.js";

const QUEUE_URL = process.env.JOBS_QUEUE_URL!;
const JOBS_TABLE = process.env.JOBS_TABLE!;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const origin = event.headers.origin || event.headers.Origin;
  const cors = buildCorsHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "" };
  }

  try {
    const parsed = JSON.parse(event.body ?? "{}") as {
      s3Key?: string;
      userId?: string;
    };

    const s3Key = parsed.s3Key?.trim();
    const userId = parsed.userId?.trim();

    if (!s3Key || !userId) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: "Missing s3Key or userId" }),
      };
    }

    const jobId = uuid();
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: JOBS_TABLE,
        Item: {
          PK: `JOB#${jobId}`,
          SK: `JOB#${jobId}`,
          userId,
          s3Key,
          status: "queued",
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({ jobId, s3Key, userId }),
      })
    );

    return {
      statusCode: 202,
      headers: cors,
      body: JSON.stringify({ status: "queued", jobId }),
    };
  } catch (err) {
    console.error("enqueue error:", err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ status: "failed", error: "enqueue failed" }),
    };
  }
};
