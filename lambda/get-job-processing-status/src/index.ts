// get-job-status.ts
import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { buildCorsHeaders } from "./cors.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const JOBS_TABLE = process.env.JOBS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent) => {
  const origin = event.headers.Origin || event.headers.origin;
  const headers = buildCorsHeaders(origin);

  const jobId = event.pathParameters?.jobId;
  if (!jobId)
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing jobId" }),
    };

  const pk = `JOB#${jobId}`;
  const resp = await ddb.send(
    new GetCommand({ TableName: JOBS_TABLE, Key: { PK: pk, SK: pk } })
  );
  if (!resp.Item)
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not found" }),
    };

  return { statusCode: 200, headers, body: JSON.stringify(resp.Item) };
};
