import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface SkillCounts {}
interface TechnologyCounts {}
interface JobPostingStats {
  id: string;
  skillCounts: SkillCounts;
  technologyCounts: TechnologyCounts;
  totalPostings: number;
  totalSkills: number;
  totalTechnologies: number;
  updatedAt: string;
}

/**
 * Lambda handler for API Gateway
 * Returns all job postings from DynamoDB
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Request received:", JSON.stringify(event, null, 2));

  // Enable CORS
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // Allow all origins (restrict in production)
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  try {
    // Handle OPTIONS request (CORS preflight)
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
      // Use GetCommand when a specific key is configured
      const cmdInput: any = { TableName, Key: { id: statsKey } };
      const response = await docClient.send(new GetCommand(cmdInput));
      stats = (response.Item || null) as JobPostingStats | null;
    } else {
      // No key configured — fall back to scanning the table and returning the first item (if any)
      const response = await docClient.send(
        new ScanCommand({ TableName, Limit: 1 })
      );
      const items = (response.Items || []) as JobPostingStats[];
      stats = items.length > 0 ? items[0] : null;
    }

    if (stats && stats.id) {
      const data = JSON.stringify(stats);
      console.log("Fetched job postings stats:", data);
      console.log(
        `Response format will be {statusCode: 200, headers, body: ${data}}`
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: data,
        }),
      };
    }
    // If we get here, no stats item was found — return 404 with an explicit body.
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
