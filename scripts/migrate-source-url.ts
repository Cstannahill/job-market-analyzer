#!/usr/bin/env ts-node

/**
 * One-time script to copy original job source URLs from the raw `job-postings`
 * table into the `job-postings-enhanced` table's `source_url` attribute.
 *
 * Reads PK records shaped like `JOB#<id>` with a constant SK of `POSTING#v1`,
 * extracts the original URL from the `sources` attribute, strips the `JOB#`
 * prefix to obtain the target `jobId`, and updates the enhanced table only
 * when a matching record exists and `source_url` is not already set.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const SOURCE_TABLE = process.env.SOURCE_TABLE || "job-postings";
const TARGET_TABLE = process.env.TARGET_TABLE || "job-postings-enhanced";
const SCAN_PAGE_SIZE = Number(process.env.SCAN_PAGE_SIZE ?? "250");
const MAX_ITEMS = Number(process.env.MAX_ITEMS ?? "0"); // 0 -> no limit
const LOG_EVERY = Number(process.env.LOG_EVERY ?? "250");
const OVERWRITE_EXISTING =
  (process.env.OVERWRITE_EXISTING ?? "false").toLowerCase() === "true";

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION })
);

type RawJobPosting = {
  PK?: string;
  SK?: string;
  sources?: unknown;
};

type MigrationStats = {
  scanned: number;
  considered: number;
  withUrl: number;
  updated: number;
  skippedNoUrl: number;
  skippedBadPk: number;
  skippedMissingTarget: number;
  skippedAlreadySet: number;
  errors: number;
};

async function* scanSourceTable(): AsyncGenerator<RawJobPosting> {
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const page = await dynamo.send(
      new ScanCommand({
        TableName: SOURCE_TABLE,
        ProjectionExpression: "#pk, #sk, #sources",
        ExpressionAttributeNames: {
          "#pk": "PK",
          "#sk": "SK",
          "#sources": "sources",
        },
        Limit: SCAN_PAGE_SIZE,
        ExclusiveStartKey,
      })
    );

    for (const item of page.Items ?? []) {
      yield item as RawJobPosting;
    }

    ExclusiveStartKey = page.LastEvaluatedKey as
      | Record<string, any>
      | undefined;
  } while (ExclusiveStartKey);
}

function stripJobPrefix(pk?: string): string | null {
  if (!pk || typeof pk !== "string") return null;
  if (!pk.startsWith("JOB#")) return null;
  const jobId = pk.slice(4).trim();
  return jobId || null;
}

function normalizeUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function extractOriginalUrl(value: unknown): string | null {
  if (!value) return null;

  const parseEntry = (entry: any): string | null => {
    if (!entry) return null;

    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          return extractOriginalUrl(parsed);
        } catch {
          return null;
        }
      }
      return null;
    }

    if (entry && typeof entry === "object" && typeof entry.S === "string") {
      return normalizeUrl(entry.S);
    }

    const record = entry.M ?? entry;
    const candidate =
      record?.originalUrl ??
      record?.original_url ??
      record?.source_url ??
      record?.url;

    if (typeof candidate === "string") {
      return normalizeUrl(candidate);
    }
    if (candidate && typeof candidate === "object" && typeof candidate.S === "string") {
      return normalizeUrl(candidate.S);
    }

    return null;
  };

  const entries = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        return [parsed];
      } catch {
        return [];
      }
    }
    if (value && typeof value === "object") {
      const list = (value as any).L;
      if (Array.isArray(list)) return list;
    }
    return [value];
  })();

  for (const entry of entries) {
    const url = parseEntry(entry);
    if (url) return url;
  }

  return null;
}

async function updateEnhanced(jobId: string, url: string): Promise<
  "updated" | "already-set" | "missing-target"
> {
  const expressionAttributeNames = { "#su": "source_url" };
  const expressionAttributeValues = { ":url": url };

  const conditionExpression = OVERWRITE_EXISTING
    ? "attribute_exists(jobId)"
    : "attribute_exists(jobId) AND attribute_not_exists(#su)";

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: TARGET_TABLE,
        Key: { jobId },
        UpdateExpression: "SET #su = :url",
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: conditionExpression,
      })
    );
    return "updated";
  } catch (error: any) {
    if (error?.name === "ConditionalCheckFailedException") {
      if (OVERWRITE_EXISTING) {
        return "missing-target";
      }
      const state = await getEnhancedState(jobId);
      if (!state.exists) return "missing-target";
      if (state.hasSourceUrl) return "already-set";
      return "missing-target";
    }
    throw error;
  }
}

async function getEnhancedState(
  jobId: string
): Promise<{ exists: boolean; hasSourceUrl: boolean }> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TARGET_TABLE,
      Key: { jobId },
      ProjectionExpression: "jobId, source_url",
    })
  );
  if (!res.Item) return { exists: false, hasSourceUrl: false };
  return {
    exists: true,
    hasSourceUrl:
      typeof (res.Item as any).source_url === "string" &&
      Boolean((res.Item as any).source_url?.trim()),
  };
}

async function run() {
  const stats: MigrationStats = {
    scanned: 0,
    considered: 0,
    withUrl: 0,
    updated: 0,
    skippedNoUrl: 0,
     skippedBadPk: 0,
    skippedMissingTarget: 0,
    skippedAlreadySet: 0,
    errors: 0,
  };

  console.log(
    "Starting source_url migration",
    JSON.stringify(
      {
        region: AWS_REGION,
        sourceTable: SOURCE_TABLE,
        targetTable: TARGET_TABLE,
        overwriteExisting: OVERWRITE_EXISTING,
        scanPageSize: SCAN_PAGE_SIZE,
        maxItems: MAX_ITEMS,
      },
      null,
      2
    )
  );

  for await (const item of scanSourceTable()) {
    stats.scanned += 1;
    if (MAX_ITEMS && stats.scanned > MAX_ITEMS) break;

    if (item.SK !== "POSTING#v1") continue;
    stats.considered += 1;

    const jobId = stripJobPrefix(item.PK);
    if (!jobId) {
      stats.skippedBadPk += 1;
      continue;
    }

    const url = extractOriginalUrl(item.sources);
    if (!url) {
      stats.skippedNoUrl += 1;
      continue;
    }
    stats.withUrl += 1;

    try {
      const result = await updateEnhanced(jobId, url);
      if (result === "updated") {
        stats.updated += 1;
      } else if (result === "already-set") {
        stats.skippedAlreadySet += 1;
      } else {
        stats.skippedMissingTarget += 1;
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`Failed to update jobId=${jobId}`, error);
    }

    if (stats.scanned % LOG_EVERY === 0) {
      console.log(
        `Progress: scanned=${stats.scanned} considered=${stats.considered} updated=${stats.updated} errors=${stats.errors}`
      );
    }
  }

  console.log("Migration complete", JSON.stringify(stats, null, 2));
}

run().catch((error) => {
  console.error("Migration failed", error);
  process.exit(1);
});
