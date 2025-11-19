import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { slugifyTech } from "./utils.js";
import type { BaseJobListing } from "@job-market-analyzer/types";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface JobPosting {
  Id?: string;
  id?: string;
  job_title?: string;
  job_description?: string;
  description?: string;
  location?: string;
  status?: string;
  processed_date?: string;
  date?: string;
  benefits?: string[] | string;
  company_size?: string;
  company_name?: string;
  industry?: string;
  remote_status?: string;
  requirements?: string[] | string;
  salary_mentioned?: boolean;
  salary_range?: string;
  seniority_level?: string;
  skills?: string[] | string;
  technologies?: string[] | string;
}
function encodeCursor(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}
function decodeCursor(b64: string) {
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

const normalizeList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeList(parsed);
        }
      } catch {
        // fall through
      }
    }
    return [trimmed];
  }
  return [];
};

const coerceString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const coerceOptionalString = (value: unknown): string | undefined => {
  const str = coerceString(value, "").trim();
  return str ? str : undefined;
};

const toBaseJobListing = (job: JobPosting): BaseJobListing => {
  const jobId = coerceString(job.Id ?? job.id ?? "", "unknown-job");
  const jobTitle = coerceString(job.job_title ?? "", "Unknown role");
  const description = coerceString(job.job_description ?? job.description ?? "");
  const location = coerceString(job.location ?? "", "Unknown");
  const processedDate =
    coerceString(job.processed_date ?? job.date ?? "") || new Date().toISOString();
  const remoteStatus = coerceString(job.remote_status ?? "", "Unknown");

  const benefits = normalizeList(job.benefits);
  const industry = normalizeList(job.industry);
  const requirements = normalizeList(job.requirements);
  const skills = normalizeList(job.skills);
  const technologies = normalizeList(job.technologies);

  return {
    jobId,
    job_title: jobTitle,
    job_description: description,
    location,
    processed_date: processedDate,
    remote_status: remoteStatus,
    status: coerceOptionalString(job.status),
    benefits: benefits.length ? benefits : undefined,
    company_name: coerceOptionalString(job.company_name),
    company_size: coerceOptionalString(job.company_size),
    industry: industry.length ? industry : undefined,
    requirements: requirements.length ? requirements : undefined,
    salary_mentioned:
      typeof job.salary_mentioned === "boolean" ? job.salary_mentioned : undefined,
    salary_range: coerceOptionalString(job.salary_range),
    seniority_level: coerceOptionalString(job.seniority_level),
    skills: skills.length ? skills : undefined,
    technologies: technologies.length ? technologies : undefined,
  };
};

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
    const parseListParam = (value?: string | null) =>
      value
        ? value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [];

    const mapRemoteFilterValue = (value: string): string | null => {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return null;
      if (/remote|wfh|distributed/.test(normalized)) {
        return "Remote";
      }
      if (/hybrid|flex/.test(normalized)) {
        return "Hybrid";
      }
      if (/on[-\s]?site|in[-\s]?office/.test(normalized)) {
        return "On-site";
      }
      return null;
    };

    const mapSeniorityFilterValue = (value: string): string | null => {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return null;
      if (/entry|junior|jr|intern|apprentice|new\s*grad/.test(normalized)) {
        return "Entry";
      }
      if (/mid|intermediate|associate/.test(normalized)) {
        return "Mid";
      }
      if (/senior|sr/.test(normalized)) {
        return "Senior";
      }
      if (/lead|principal|staff|architect|manager/.test(normalized)) {
        return "Lead";
      }
      return null;
    };

    const remoteStatusFilters = parseListParam(qs.remote_status)
      .map(mapRemoteFilterValue)
      .filter((value): value is string => Boolean(value));
    const seniorityFilters = parseListParam(qs.seniority_level)
      .map(mapSeniorityFilterValue)
      .filter((value): value is string => Boolean(value));
    const remoteStatusSet = new Set(remoteStatusFilters);
    const senioritySet = new Set(seniorityFilters);

    const matchesJobFilters = (job: JobPosting) => {
      if (remoteStatusSet.size > 0) {
        const jobRemote = job.remote_status
          ? mapRemoteFilterValue(job.remote_status)
          : null;
        if (!jobRemote || !remoteStatusSet.has(jobRemote)) {
          return false;
        }
      }

      if (senioritySet.size > 0) {
        const jobSeniority = job.seniority_level
          ? mapSeniorityFilterValue(job.seniority_level)
          : null;
        if (!jobSeniority || !senioritySet.has(jobSeniority)) {
          return false;
        }
      }

      return true;
    };

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
      const collected: JobPosting[] = [];
      let techIndexCursor: Record<string, unknown> | undefined =
        ExclusiveStartKey;

      do {
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
          ...(techIndexCursor && { ExclusiveStartKey: techIndexCursor }),
        });

        const iq = await docClient.send(q);
        const indexRows = iq.Items ?? [];

        const jobIds = indexRows
          .map((it) => (it.jobId as string) || String(it.SK).split("#").pop())
          .filter(Boolean) as string[];

        if (jobIds.length > 0) {
          const keys = jobIds.map((jobId) => ({ jobId }));
          const bg = new BatchGetCommand({
            RequestItems: { [TableName]: { Keys: keys } },
          });
          const br = await docClient.send(bg);
          const jobs = (br.Responses?.[TableName] ?? []) as JobPosting[];

          jobs.sort((a, b) =>
            ScanIndexForward
              ? (a.processed_date ?? "").localeCompare(b.processed_date ?? "")
              : (b.processed_date ?? "").localeCompare(a.processed_date ?? "")
          );

          collected.push(...jobs.filter(matchesJobFilters));
        }

        techIndexCursor = iq.LastEvaluatedKey;
      } while (collected.length < limit && techIndexCursor);

      const filteredJobs = collected.slice(0, limit);
      const next = techIndexCursor ? encodeCursor(techIndexCursor) : null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: filteredJobs.length,
          data: filteredJobs,
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
    const expressionAttributeNames: Record<string, string> = {
      "#status": "status",
    };
    const expressionAttributeValues: Record<string, unknown> = {
      ":status": StatusValue,
    };
    const filterExpressions: string[] = [];

    if (remoteStatusFilters.length) {
      expressionAttributeNames["#remote_status"] = "remote_status";
      const placeholders = remoteStatusFilters.map((value, index) => {
        const key = `:remoteStatus${index}`;
        expressionAttributeValues[key] = value;
        return key;
      });
      filterExpressions.push(`#remote_status IN (${placeholders.join(", ")})`);
    }

    if (seniorityFilters.length) {
      expressionAttributeNames["#seniority_level"] = "seniority_level";
      const placeholders = seniorityFilters.map((value, index) => {
        const key = `:seniorityLevel${index}`;
        expressionAttributeValues[key] = value;
        return key;
      });
      filterExpressions.push(
        `#seniority_level IN (${placeholders.join(", ")})`
      );
    }

    const buildQueryInput = (
      startKey?: Record<string, unknown> | undefined
    ) => ({
      TableName,
      IndexName,
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
      ScanIndexForward, // true for ASC, false for DESC (newest first)
      ...(startKey && { ExclusiveStartKey: startKey }),
      ...(filterExpressions.length && {
        FilterExpression: filterExpressions.join(" AND "),
      }),
    });

    const aggregated: JobPosting[] = [];
    let queryCursor: Record<string, unknown> | undefined = ExclusiveStartKey;

    do {
      const queryInput = buildQueryInput(queryCursor);
      console.log("Executing query with params:", {
        TableName,
        IndexName,
        Status: StatusValue,
        Limit: limit,
        ScanIndexForward,
        hasExclusiveStartKey: !!queryCursor,
        remoteStatusFilters,
        seniorityFilters,
      });
      const queryCommand = new QueryCommand(queryInput);
      const response = await docClient.send(queryCommand);
      const items = (response.Items || []) as JobPosting[];
      aggregated.push(...items.filter(matchesJobFilters));
      queryCursor = response.LastEvaluatedKey;
    } while (aggregated.length < limit && queryCursor);

    const pagedItems = aggregated.slice(0, limit);
    const normalizedItems: BaseJobListing[] = pagedItems.map(toBaseJobListing);

    let encodedLastKey: string | null = null;
    if (queryCursor) {
      try {
        const json = JSON.stringify(queryCursor);
        encodedLastKey = Buffer.from(json, "utf8").toString("base64");
        console.log("Encoded lastKey for next page");
      } catch (err) {
        console.error("Failed to encode LastEvaluatedKey:", err);
      }
    }

    console.log(
      `Retrieved ${pagedItems.length} filtered items, hasMore: ${!!encodedLastKey}`
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: pagedItems.length,
        data: normalizedItems,
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
