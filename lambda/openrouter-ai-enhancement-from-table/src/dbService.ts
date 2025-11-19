import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  QueryCommand,
  type QueryCommandOutput,
  type NativeAttributeValue,
  type ScanCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { logDebug, logInfo } from "./logging.js";
import type { EnrichedJobData, JobRecord } from "./types.js";
import { safeString, dtStr, now, yyyymmdd } from "./utils.js";

//#region CONFIG START
const MAX_ITEMS_PER_RUN = Number(process.env.MAX_ITEMS_PER_RUN || 50);
const MAX_SCAN_PAGES = Number(process.env.MAX_SCAN_PAGES || 20);
const SOURCE_TABLE = process.env.SOURCE_TABLE || "job-postings"; // raw ingest table
const ENRICHMENT_TABLE =
  process.env.ENRICHMENT_TABLE || "job-postings-enhanced";
//#endregion

//#region DB Client Initialization
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
//#endregion

async function isJobProcessed(jobId: string): Promise<boolean> {
  try {
    const command = new GetCommand({
      TableName: ENRICHMENT_TABLE,
      Key: { jobId },
    });
    const response = await docClient.send(command);
    return !!response.Item;
  } catch (error) {
    console.error(`Error checking if ${jobId} is processed:`, error);
    return false;
  }
}

export function validateEnrichedData(
  data: any,
  fallbackJobId: string
): EnrichedJobData {
  const fallbackTitle = data.job_title ?? data.title ?? "Unknown role";
  const fallbackDescription =
    typeof data.job_description === "string" && data.job_description.trim()
      ? data.job_description
      : data.description ?? "";
  const fallbackLocation = data.location ?? data.locationRaw ?? "Unknown";
  const remoteStatusValue = (() => {
    const val =
      typeof data.remote_status === "string" ? data.remote_status.trim() : "";
    if (!val) return "not_specified";
    return val;
  })();

  const validated: EnrichedJobData = {
    jobId: typeof data.jobId === "string" ? data.jobId : fallbackJobId,
    job_title:
      typeof fallbackTitle === "string"
        ? fallbackTitle.trim() || "Unknown role"
        : "Unknown role",
    job_description:
      typeof fallbackDescription === "string"
        ? fallbackDescription.trim() || "Description unavailable"
        : "Description unavailable",
    technologies: Array.isArray(data.technologies)
      ? data.technologies
          .filter((t: unknown): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    skills: Array.isArray(data.skills)
      ? data.skills
          .filter((s: unknown): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    requirements: Array.isArray(data.requirements)
      ? data.requirements
          .filter((r: unknown): r is string => typeof r === "string")
          .map((r) => r.trim())
          .filter(Boolean)
      : [],
    years_exp_req:
      typeof data.years_exp_req === "string"
        ? data.years_exp_req.trim() || undefined
        : typeof data.years_exp_req === "number" &&
          Number.isFinite(data.years_exp_req)
        ? `${data.years_exp_req}`
        : undefined,
    seniority_level: ["Junior", "Mid", "Senior", "Lead", "Executive"].includes(
      data.seniority_level
    )
      ? data.seniority_level
      : "Mid",
    location: typeof fallbackLocation === "string"
      ? fallbackLocation.trim() || "Unknown"
      : "Unknown",
    company_name:
      typeof data.company_name === "string"
        ? data.company_name.trim()
        : undefined,
    salary_mentioned: Boolean(data.salary_mentioned),
    salary_range:
      typeof data.salary_range === "string"
        ? data.salary_range.trim()
        : undefined,
    remote_status: remoteStatusValue,
    benefits: Array.isArray(data.benefits)
      ? data.benefits.filter((b: any) => typeof b === "string" && b.trim())
      : [],
    company_size: [
      "Startup",
      "Small",
      "Medium",
      "Large",
      "Enterprise",
    ].includes(data.company_size)
      ? data.company_size
      : undefined,
    industry:
      typeof data.industry === "string" ? data.industry.trim() : undefined,
    processed_date: new Date().toISOString(),
    status: "Active",
    source_url:
      typeof data.source_url === "string" ? data.source_url.trim() : undefined,
    job_board_source:
      typeof data.job_board_source === "string"
        ? data.job_board_source.trim()
        : undefined,
  };

  // small dedupe
  validated.technologies = [...new Set(validated.technologies)];
  validated.skills = [...new Set(validated.skills)];
  validated.requirements = [...new Set(validated.requirements)];
  validated.benefits = [...new Set(validated.benefits)];

  logDebug(
    `validate ${validated.jobId} | tech=${validated.technologies.length} skills=${validated.skills.length}`
  );
  return validated;
}

export async function saveEnrichedData(
  data: EnrichedJobData,
  runId: string
): Promise<void> {
  const t0 = now();
  const item: EnrichedJobData = {
    ...data,
    enrichment_run_id: runId,
  };
  await docClient.send(
    new PutCommand({ TableName: ENRICHMENT_TABLE, Item: item })
  );
  logInfo(`saved jobId=${data.jobId} in ${dtStr(t0)}`);
}

export async function getUnprocessedJobsFromDynamo(): Promise<JobRecord[]> {
  const results: JobRecord[] = [];

  const LOOKBACK_DAYS = Number(process.env.UNPROCESSED_LOOKBACK_DAYS ?? "7");

  // Normalize "today" to a pure UTC date
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  for (let offset = 0; offset < LOOKBACK_DAYS; offset++) {
    if (results.length >= MAX_ITEMS_PER_RUN) break;

    // Compute the date we’re querying for
    const day = new Date(todayUtc);
    day.setUTCDate(todayUtc.getUTCDate() - offset);
    const dateStr = yyyymmdd(day);

    let lastEvaluatedKey: Record<string, NativeAttributeValue> | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      if (pageCount > MAX_SCAN_PAGES) break; // keep your safety valve if you want

      const queryResp: QueryCommandOutput = await docClient.send(
        new QueryCommand({
          TableName: SOURCE_TABLE,
          IndexName: "postedDate-PK-index",
          KeyConditionExpression: "#pd = :pd",
          ExpressionAttributeNames: {
            "#pd": "postedDate",
          },
          ExpressionAttributeValues: {
            ":pd": dateStr,
          },
          Limit: 200,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      const items = queryResp.Items ?? [];

      for (const item of items) {
        if (!item.PK || typeof item.PK !== "string") continue;

        const jobId = item.PK.replace(/^JOB#/, "");
        const sourceDetails = extractSourceDetails(item.sources);

        const alreadyProcessed = await isJobProcessed(jobId);
        if (alreadyProcessed) continue;

        results.push({
          jobId,
          company: safeString(item.company),
          title: safeString(item.title),
          description: safeString(item.description),
          postedDate: safeString(item.postedDate),
          locationRaw: safeString(item.location),
          sourcesRaw: safeString(item.sources),
          sourceUrl: sourceDetails?.url,
          jobBoardSource: sourceDetails?.jobBoardSource,
        });

        if (results.length >= MAX_ITEMS_PER_RUN) break;
      }

      lastEvaluatedKey = queryResp.LastEvaluatedKey as
        | Record<string, NativeAttributeValue>
        | undefined;
    } while (lastEvaluatedKey && results.length < MAX_ITEMS_PER_RUN);
  }

  return results;
}

type SourceDetails = {
  url?: string;
  jobBoardSource?: string;
};

function extractOriginalUrl(value: unknown): string | undefined {
  return extractSourceDetails(value)?.url;
}

function extractSourceDetails(value: unknown): SourceDetails | undefined {
  if (!value) return undefined;

  const attemptRead = (entry: any): SourceDetails | undefined => {
    const asString = readAttributeString(entry);
    if (asString) {
      if (asString.startsWith("http")) return { url: asString };
      try {
        const parsed = JSON.parse(asString);
        return attemptRead(parsed);
      } catch {
        return undefined;
      }
    }

    if (!entry || typeof entry !== "object") return undefined;

    const record = entry.M ?? entry;
    if (!record || typeof record !== "object") return undefined;

    const url =
      readAttributeString(record.originalUrl) ??
      readAttributeString(record.original_url) ??
      readAttributeString(record.url) ??
      readAttributeString(record.source_url);

    const jobBoardSource =
      readAttributeString(record.source) ??
      readAttributeString(record.source_name) ??
      readAttributeString(record.sourceName) ??
      readAttributeString(record.job_board_source) ??
      readAttributeString(record.job_board);

    if (url || jobBoardSource) {
      return { url, jobBoardSource };
    }
    return undefined;
  };

  const asArray = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (value && typeof value === "object") {
      if (Array.isArray((value as any).L)) return (value as any).L;
    }
    return [];
  })();

  for (const entry of asArray) {
    const details = attemptRead(entry);
    if (details && (details.url || details.jobBoardSource)) {
      return details;
    }
  }

  if (asArray.length === 0) {
    const fallback = attemptRead(value);
    if (fallback && (fallback.url || fallback.jobBoardSource)) {
      return fallback;
    }
  }

  return undefined;
}

function readAttributeString(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof value === "object" && typeof value.S === "string") {
    const trimmed = value.S.trim();
    return trimmed.length ? trimmed : undefined;
  }
  return undefined;
}
