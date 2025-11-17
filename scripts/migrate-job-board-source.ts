#!/usr/bin/env ts-node

/**
 * One-time script to copy job board source names from the raw `job-postings`
 * table into the `job-postings-enhanced` table's `job_board_source` attribute.
 *
 * Reads PK records shaped like `JOB#<id>` with `SK = POSTING#v1`, extracts the
 * `source`-style field from the `sources` attribute, strips the `JOB#` prefix to
 * obtain `jobId`, and updates the enhanced table only when a matching record
 * exists and `job_board_source` is not already set (unless overwrite is enabled).
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
  withSource: number;
  updated: number;
  skippedNoSource: number;
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

function normalizeSource(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function extractJobBoardSource(value: unknown): string | null {
  if (!value) return null;

  const parseEntry = (entry: any): string | null => {
    if (!entry) return null;

    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          return extractJobBoardSource(parsed);
        } catch {
          return null;
        }
      }
      return normalizeSource(trimmed);
    }

    if (entry && typeof entry === "object" && typeof entry.S === "string") {
      return normalizeSource(entry.S);
    }

    if (!entry || typeof entry !== "object") return null;
    const record = entry.M ?? entry;
    if (!record || typeof record !== "object") return null;

    const candidate =
      record?.source ??
      record?.source_name ??
      record?.sourceName ??
      record?.job_board_source ??
      record?.job_board ??
      record?.jobBoard ??
      record?.name;

    if (typeof candidate === "string") {
      return normalizeSource(candidate);
    }
    if (
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.S === "string"
    ) {
      return normalizeSource(candidate.S);
    }

    return null;
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
    const source = parseEntry(entry);
    if (source) return source;
  }

  if (asArray.length === 0) {
    return parseEntry(value);
  }

  return null;
}

async function updateEnhanced(
  jobId: string,
  jobBoardSource: string
): Promise<"updated" | "already-set" | "missing-target"> {
  const expressionAttributeNames = { "#jbs": "job_board_source" };
  const expressionAttributeValues = { ":source": jobBoardSource };

  const conditionExpression = OVERWRITE_EXISTING
    ? "attribute_exists(jobId)"
    : "attribute_exists(jobId) AND attribute_not_exists(#jbs)";

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: TARGET_TABLE,
        Key: { jobId },
        UpdateExpression: "SET #jbs = :source",
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
      if (state.hasJobBoardSource) return "already-set";
      return "missing-target";
    }
    throw error;
  }
}

async function getEnhancedState(
  jobId: string
): Promise<{ exists: boolean; hasJobBoardSource: boolean }> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TARGET_TABLE,
      Key: { jobId },
      ProjectionExpression: "jobId, job_board_source",
    })
  );
  if (!res.Item) return { exists: false, hasJobBoardSource: false };
  return {
    exists: true,
    hasJobBoardSource:
      typeof (res.Item as any).job_board_source === "string" &&
      Boolean((res.Item as any).job_board_source?.trim()),
  };
}

async function run() {
  const stats: MigrationStats = {
    scanned: 0,
    considered: 0,
    withSource: 0,
    updated: 0,
    skippedNoSource: 0,
    skippedBadPk: 0,
    skippedMissingTarget: 0,
    skippedAlreadySet: 0,
    errors: 0,
  };

  console.log(
    "Starting job_board_source migration",
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

    const sourceName = extractJobBoardSource(item.sources);
    if (!sourceName) {
      stats.skippedNoSource += 1;
      continue;
    }
    stats.withSource += 1;

    try {
      const result = await updateEnhanced(jobId, sourceName);
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

