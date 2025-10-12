import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface JobPosting {
  Id: string;
  job_title?: string;
  job_description?: string;
  location?: string;
  status: string;
  processed_date: string;
  benefits?: string[];
  company_size?: string;
  company_name?: string;
  industry?: string;
  remote_status?: string;
  requirements?: string[];
  salary_mentioned?: boolean;
  salary_range?: string;
  seniority_level?: string;
  skills: string[];
  technologies: string[];
}

/**
 * Lambda handler for API Gateway
 * Returns paginated job postings from DynamoDB using Query on GSI
 *
 * GSI: status-processed_date-index
 *   - Partition Key: status (e.g., "Active")
 *   - Sort Key: processed_date (enables sorting and efficient pagination)
 *
 * Best Practices Implemented:
 * 1. Query instead of Scan for better performance
 * 2. Efficient pagination using DynamoDB's native LastEvaluatedKey
 * 3. Results automatically sorted by processed_date (descending/newest first)
 * 4. Configurable page size with sensible defaults
 * 5. Proper error handling and logging
 * 6. Support for status filtering via query parameter
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
    const IndexName = process.env.GSI_NAME || "status-processed_date-index";

    // Default to querying "Active" status postings
    const StatusValue = event.queryStringParameters?.status || "Active";

    // Parse query parameters
    const limitParam = event.queryStringParameters?.limit;
    const lastKeyParam = event.queryStringParameters?.lastKey;
    const sortOrderParam = event.queryStringParameters?.sortOrder || "DESC"; // DESC for newest first

    // Default to 20 items per page, max 100 to prevent abuse
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
      : 20;

    const ScanIndexForward = sortOrderParam.toUpperCase() === "ASC";

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

    // Query DynamoDB using GSI with pagination
    const queryCommand = new QueryCommand({
      TableName,
      IndexName,
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": StatusValue,
      },
      Limit: limit,
      ScanIndexForward, // true for ASC, false for DESC (newest first)
      ...(ExclusiveStartKey && { ExclusiveStartKey }),
    });

    console.log("Executing query with params:", {
      TableName,
      IndexName,
      Status: StatusValue,
      Limit: limit,
      ScanIndexForward,
      hasExclusiveStartKey: !!ExclusiveStartKey,
    });

    const response = await docClient.send(queryCommand);
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
    // Results are automatically sorted by processed_date (order controlled by ScanIndexForward)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: items.length,
        data: items,
        lastKey: encodedLastKey,
        hasMore: !!encodedLastKey,
        status: StatusValue,
        sortOrder: ScanIndexForward ? "ASC" : "DESC",
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
 * SETUP NOTES:
 *
 * 1. GSI SETUP:
 *    - Index Name: status-processed_date-index
 *    - Partition Key: status (string)
 *    - Sort Key: processed_date (string)
 *    - All items should have a status field (e.g., "Active", "Archived", etc.)
 *
 * 2. ENVIRONMENT VARIABLES:
 *    Add to your Lambda environment:
 *    - GSI_NAME: "status-processed_date-index"
 *    - DYNAMODB_TABLE_NAME: "JobPostings"
 *
 * 3. PERFORMANCE BENEFITS:
 *    - Query on status partition key for efficient data retrieval
 *    - Results sorted by processed_date automatically
 *    - Better RCU efficiency than Scan
 *    - Supports ascending/descending sort via ScanIndexForward
 *    - Can efficiently filter by status (Active, Archived, etc.)
 *
 * 4. QUERY PARAMETERS:
 *    ?status=Active&limit=50&sortOrder=DESC&lastKey=<encoded_key>
 *    - status: Filter by status value (default: "Active")
 *    - limit: 1-100 items per page (default: 20)
 *    - sortOrder: "ASC" or "DESC" (default: DESC for newest first)
 *    - lastKey: pagination cursor (base64-encoded)
 *
 * 5. EXAMPLE REQUESTS:
 *    - Get first 20 active jobs (newest first):
 *      GET /jobs
 *
 *    - Get 50 active jobs oldest first:
 *      GET /jobs?limit=50&sortOrder=ASC
 *
 *    - Get archived jobs (paginated):
 *      GET /jobs?status=Archived&limit=25
 *
 *    - Get next page of results:
 *      GET /jobs?lastKey=<encoded_key>&limit=20
 *
 * 6. DATA REQUIREMENTS:
 *    All items must have:
 *    - Id (primary key)
 *    - status (for GSI partition key)
 *    - processed_date (for GSI sort key)
 */
