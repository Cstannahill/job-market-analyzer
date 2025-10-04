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
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit)
      : 50; // Default to 50 items

    // Scan DynamoDB table
    const command = new ScanCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || "JobPostings",
      Limit: limit,
    });

    const response = await docClient.send(command);
    const jobPostings = (response.Items || []) as JobPosting[];

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
