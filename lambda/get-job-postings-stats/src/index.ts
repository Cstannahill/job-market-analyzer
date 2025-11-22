import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { JobStats } from "@job-market-analyzer/types";

const SKILLS_TABLE = "job-postings-skills";
const TECHNOLOGIES_TABLE = "job-postings-technologies";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface SkillCounts {}
interface TechnologyCounts {}
type JobPostingStats = JobStats & { id: string };

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Request received:", JSON.stringify(event, null, 2));

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers,
        body: "",
      };
    }

    const TableName = process.env.DYNAMODB_TABLE_NAME || "job-postings-stats";
    const statsKey = process.env.STATISTICS_KEY || "";

    let stats: JobPostingStats | null = null;

    if (statsKey) {
      const cmdInput: any = { TableName, Key: { id: statsKey } };
      const response = await docClient.send(new GetCommand(cmdInput));
      stats = (response.Item || null) as JobPostingStats | null;
    } else {
      const response = await docClient.send(
        new ScanCommand({ TableName, Limit: 1 })
      );
      const items = (response.Items || []) as JobPostingStats[];
      stats = items.length > 0 ? items[0] : null;
    }

    if (stats && stats.id) {
      console.log("Fetched job postings stats:", stats);
      console.log(
        `Response format will be {statusCode: 200, headers, body: ${stats}}`
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: stats,
        }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Job postings stats not found",
      }),
    };
  } catch (error) {
    console.error("Error fetching job postings stats:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch job postings",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
