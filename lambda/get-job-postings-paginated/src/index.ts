import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { slugifyTech } from "./utils.js";

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
function encodeCursor(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}
function decodeCursor(b64: string) {
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

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

    const TableName =
      process.env.DYNAMODB_TABLE_NAME || "job-postings-enhanced";
    const IndexName = process.env.GSI_NAME || "status-processed_date-index";
    const TechIndexTable =
      process.env.JOB_TECH_INDEX_TABLE || "job-tech-index-v2";

    const qs = event.queryStringParameters ?? {};
    const StatusValue = event.queryStringParameters?.status || "Active";
    const techParam = qs.tech?.trim();
    const limitParam = event.queryStringParameters?.limit;
    const lastKeyParam = event.queryStringParameters?.lastKey;
    const sortOrderParam = event.queryStringParameters?.sortOrder || "DESC";

    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
      : 20;

    const ScanIndexForward = sortOrderParam.toUpperCase() === "ASC";

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

    // tech query
    if (techParam) {
      const techSlug = slugifyTech(techParam);

      // Query companion table by PK=tech and SK prefix = `${status}#`
      const q = new QueryCommand({
        TableName: TechIndexTable,
        KeyConditionExpression: "#pk = :t AND begins_with(#sk, :p)",
        ExpressionAttributeNames: { "#pk": "PK", "#sk": "SK" },
        ExpressionAttributeValues: {
          ":t": techSlug,
          ":p": `${StatusValue}#`,
        },
        Limit: limit,
        ScanIndexForward, // ASC=>oldest first, DESC=>newest first
        ...(ExclusiveStartKey && { ExclusiveStartKey }),
      });

      const iq = await docClient.send(q);
      const indexRows = iq.Items ?? [];

      // Get jobIds from either explicit attr or from SK suffix
      const jobIds = indexRows
        .map((it) => (it.jobId as string) || String(it.SK).split("#").pop())
        .filter(Boolean) as string[];

      let jobs: JobPosting[] = [];
      if (jobIds.length > 0) {
        // BatchGet full items from main table (assumes PK = Id)
        const keys = jobIds.map((jobId) => ({ jobId }));
        const bg = new BatchGetCommand({
          RequestItems: { [TableName]: { Keys: keys } },
        });
        const br = await docClient.send(bg);
        jobs = (br.Responses?.[TableName] ?? []) as JobPosting[];

        // BatchGet order is undefined — sort to match requested order
        // (We sort by processed_date; Dynamo already handed us SK order)
        jobs.sort((a, b) =>
          ScanIndexForward
            ? (a.processed_date ?? "").localeCompare(b.processed_date ?? "")
            : (b.processed_date ?? "").localeCompare(a.processed_date ?? "")
        );
      }

      const next = iq.LastEvaluatedKey
        ? encodeCursor(iq.LastEvaluatedKey)
        : null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: jobs.length,
          data: jobs,
          lastKey: next,
          hasMore: !!next,
          status: StatusValue,
          sortOrder: ScanIndexForward ? "ASC" : "DESC",
          techSlug, // helpful for the client
          source: "tech-index",
        }),
      };
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
