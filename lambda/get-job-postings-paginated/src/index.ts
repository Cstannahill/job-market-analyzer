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
 * Returns paginated job postings from DynamoDB
 *
 * Best Practices Implemented:
 * 1. Efficient pagination using DynamoDB's native LastEvaluatedKey
 * 2. No in-memory sorting (sorting done client-side or use GSI with sort key)
 * 3. Configurable page size with sensible defaults
 * 4. Proper error handling and logging
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Request received:", JSON.stringify(event, null, 2));

  // Enable CORS
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // Restrict in production
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

    const TableName = process.env.DYNAMODB_TABLE_NAME || "JobPostings";

    // Parse query parameters
    const limitParam = event.queryStringParameters?.limit;
    const lastKeyParam = event.queryStringParameters?.lastKey;

    // Default to 20 items per page, max 100 to prevent abuse
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
      : 20;

    // Decode the lastKey (base64-encoded JSON)
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    if (lastKeyParam) {
      try {
        const decoded = Buffer.from(lastKeyParam, "base64").toString("utf8");
        ExclusiveStartKey = JSON.parse(decoded);
        console.log("Decoded ExclusiveStartKey:", ExclusiveStartKey);
      } catch (err) {
        console.warn("Invalid lastKey parameter:", err);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Invalid lastKey parameter",
          }),
        };
      }
    }

    // Scan DynamoDB with pagination
    const scanCommand = new ScanCommand({
      TableName,
      Limit: limit,
      ...(ExclusiveStartKey && { ExclusiveStartKey }),
    });

    console.log("Executing scan with params:", {
      TableName,
      Limit: limit,
      hasExclusiveStartKey: !!ExclusiveStartKey,
    });

    const response = await docClient.send(scanCommand);
    const items = (response.Items || []) as JobPosting[];

    // Encode the LastEvaluatedKey for the next page
    let encodedLastKey: string | null = null;
    if (response.LastEvaluatedKey) {
      try {
        const json = JSON.stringify(response.LastEvaluatedKey);
        encodedLastKey = Buffer.from(json, "utf8").toString("base64");
        console.log("Encoded lastKey for next page");
      } catch (err) {
        console.error("Failed to encode LastEvaluatedKey:", err);
      }
    }

    console.log(
      `Retrieved ${items.length} items, hasMore: ${!!encodedLastKey}`
    );

    // Return paginated response
    // Note: Sorting is NOT done here for pagination efficiency
    // Client should either:
    // 1. Sort on the frontend after fetching all needed pages
    // 2. Use a DynamoDB GSI with a sort key for server-side sorted queries
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: items.length,
        data: items,
        lastKey: encodedLastKey,
        // Optional: Include metadata
        hasMore: !!encodedLastKey,
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

/**
 * IMPORTANT NOTES FOR PRODUCTION:
 *
 * 1. SORTING CONSIDERATION:
 *    - This Lambda does NOT sort results to maintain pagination efficiency
 *    - DynamoDB Scan returns items in arbitrary order
 *    - For sorted results by date, consider:
 *      a) Create a GSI with date as sort key and use Query instead of Scan
 *      b) Sort on the client-side after fetching all pages
 *      c) Use a separate endpoint for "get all" that does full scan + sort
 *
 * 2. PERFORMANCE OPTIMIZATION:
 *    - Scan is expensive on large tables - consider Query with GSI
 *    - Use ParallelScan for very large tables (requires coordination)
 *    - Consider caching frequently accessed pages
 *
 * 3. COST OPTIMIZATION:
 *    - Limit max page size to prevent abuse
 *    - Consider using DynamoDB On-Demand if traffic is unpredictable
 *    - Monitor RCU consumption
 *
 * 4. RECOMMENDED TABLE DESIGN:
 *    Primary Key: Id (partition key)
 *    GSI: date-index
 *      - PK: status (e.g., "ACTIVE")
 *      - SK: date (sort key)
 *    This allows efficient Query operations sorted by date
 */
