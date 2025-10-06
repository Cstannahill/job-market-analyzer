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
    const requestedLimit = limitParam ? parseInt(limitParam) : undefined;

    // If a numeric limit is provided, we will respect it. If not provided,
    // paginate through all Scan pages to return the full result set (careful
    // with very large tables — consider using a count-only endpoint or
    // pagination in the client for production).

    const TableName = process.env.DYNAMODB_TABLE_NAME || "JobPostings";
    const jobPostings: JobPosting[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined = undefined;

    do {
      const cmdInput: any = { TableName };
      if (typeof requestedLimit === "number") cmdInput.Limit = requestedLimit;
      if (ExclusiveStartKey) cmdInput.ExclusiveStartKey = ExclusiveStartKey;

      const response = await docClient.send(new ScanCommand(cmdInput));
      const items = (response.Items || []) as JobPosting[];
      jobPostings.push(...items);

      ExclusiveStartKey = (response as any).LastEvaluatedKey;

      // If a numeric limit was specified, stop after first page — we've honored Limit
      // (or when we've accumulated at least that many items)
      if (
        typeof requestedLimit === "number" &&
        jobPostings.length >= requestedLimit
      ) {
        break;
      }
    } while (ExclusiveStartKey);

    // Sort by date (newest first)
    jobPostings.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    console.log(`Successfully retrieved ${jobPostings.length} job postings`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: jobPostings.length,
        data: jobPostings,
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
