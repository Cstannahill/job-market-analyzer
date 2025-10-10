import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface JobPosting {
  Id: string;
  title: string;
  skills: string[];
  technologies: string[];
  raw_text: string;
  date: string;
  source_file: string;
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

    // Get query parameters for pagination (optional)
    const limitParam = event.queryStringParameters?.limit;
    const requestedLimit = limitParam ? parseInt(limitParam, 10) : undefined;
    const lastKeyParam = event.queryStringParameters?.lastKey;

    // lastKey is expected to be a base64-encoded JSON string of the LastEvaluatedKey
    let ExclusiveStartKey: Record<string, unknown> | undefined = undefined;
    if (lastKeyParam) {
      try {
        const decoded = Buffer.from(lastKeyParam, "base64").toString("utf8");
        ExclusiveStartKey = JSON.parse(decoded) as Record<string, unknown>;
      } catch (err) {
        console.warn("Invalid lastKey param, ignoring:", lastKeyParam);
      }
    }
    const TableName = process.env.DYNAMODB_TABLE_NAME || "JobPostings";
    // If pagination params are provided (limit or lastKey), return a single page
    // Otherwise, fall back to scanning the entire table (previous behavior).
    const jobPostings: JobPosting[] = [];
    let response: any = null;

    const cmdInput: any = { TableName };
    if (typeof requestedLimit === "number") cmdInput.Limit = requestedLimit;
    if (ExclusiveStartKey) cmdInput.ExclusiveStartKey = ExclusiveStartKey;

    response = await docClient.send(new ScanCommand(cmdInput));
    const items = (response.Items || []) as JobPosting[];
    jobPostings.push(...items);

    const rawLastKey = (response as any).LastEvaluatedKey;
    let encodedLastKey: string | undefined = undefined;
    if (rawLastKey) {
      try {
        const json = JSON.stringify(rawLastKey);
        encodedLastKey = Buffer.from(json, "utf8").toString("base64");
      } catch (err) {
        console.warn("Failed to encode LastEvaluatedKey", err);
      }
    }

    // Sort by date (newest first)
    jobPostings.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    console.log(`Successfully retrieved ${jobPostings.length} job postings`);

    // If no pagination params were provided, and requestedLimit is undefined
    // keep legacy behavior and scan the entire table (careful on large tables).
    if (typeof requestedLimit !== "number" && !lastKeyParam) {
      // continue scanning to collect all pages
      let ExclusiveStart = (response as any).LastEvaluatedKey;
      while (ExclusiveStart) {
        const next = await docClient.send(
          new ScanCommand({ TableName, ExclusiveStartKey: ExclusiveStart })
        );
        const nextItems = (next.Items || []) as JobPosting[];
        jobPostings.push(...nextItems);
        ExclusiveStart = (next as any).LastEvaluatedKey;
      }

      // Sort by date (newest first)
      jobPostings.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: jobPostings.length,
          data: jobPostings,
        }),
      };
    }

    // Paginated response: return page + lastKey token (if any)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: jobPostings.length,
        data: jobPostings,
        lastKey: encodedLastKey ?? null,
      }),
    };
  } catch (error) {
    console.error("Error fetching job postings:", error);

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
