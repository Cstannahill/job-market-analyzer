#!/usr/bin/env ts-node

/**
 * One-time script to copy `source_url` values from the job-postings-enhanced
 * DynamoDB table into the Neon/Postgres `jobs` table.
 *
 * For each Dynamo item (PK: jobId) that has a non-empty `source_url`, the script
 * updates the matching Neon row (matched by `dynamo_id`). Existing values are
 * preserved unless OVERWRITE_EXISTING=true.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { Client as PgClient } from "pg";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const DYNAMO_TABLE =
  process.env.DYNAMO_TABLE || "job-postings-enhanced";
const PG_CONNECTION =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.PG_CONNECTION_STRING ||
  "";
const SCAN_PAGE_SIZE = Number(process.env.SCAN_PAGE_SIZE ?? "250");
const MAX_ITEMS = Number(process.env.MAX_ITEMS ?? "0"); // 0 => no limit
const LOG_EVERY = Number(process.env.LOG_EVERY ?? "250");
const OVERWRITE_EXISTING =
  (process.env.OVERWRITE_EXISTING ?? "false").toLowerCase() === "true";

if (!PG_CONNECTION) {
  throw new Error(
    "DATABASE_URL or NEON_DATABASE_URL (or PG_CONNECTION_STRING) must be set."
  );
}

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: AWS_REGION })
);
const pg = new PgClient({ connectionString: PG_CONNECTION });

type EnhancedItem = {
  jobId?: string;
  source_url?: string | null;
};

type Stats = {
  scanned: number;
  withUrl: number;
  updated: number;
  skippedNoUrl: number;
  skippedMissingJob: number;
  skippedAlreadySet: number;
  errors: number;
};

function normalizeJobId(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

async function* scanEnhancedTable(): AsyncGenerator<EnhancedItem> {
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const res = await dynamo.send(
      new ScanCommand({
        TableName: DYNAMO_TABLE,
        ProjectionExpression: "jobId, source_url",
        ExclusiveStartKey,
        Limit: SCAN_PAGE_SIZE,
      })
    );
    for (const item of res.Items ?? []) {
      yield item as EnhancedItem;
    }
    ExclusiveStartKey = res.LastEvaluatedKey as
      | Record<string, any>
      | undefined;
  } while (ExclusiveStartKey);
}

async function updateNeon(jobId: string, url: string): Promise<
  "updated" | "already-set" | "missing-job"
> {
  const baseQuery = OVERWRITE_EXISTING
    ? `UPDATE jobs SET source_url = $2 WHERE dynamo_id = $1`
    : `UPDATE jobs SET source_url = $2 WHERE dynamo_id = $1 AND (source_url IS NULL OR source_url = '')`;

  const result = await pg.query(baseQuery, [jobId, url]);
  if (result.rowCount && result.rowCount > 0) {
    return "updated";
  }

  const check = await pg.query<{ source_url: string | null }>(
    `SELECT source_url FROM jobs WHERE dynamo_id = $1`,
    [jobId]
  );
  if (check.rowCount === 0) return "missing-job";
  const existing = check.rows[0]?.source_url;
  if (existing && existing.trim()) return "already-set";
  return "missing-job";
}

async function run() {
  await pg.connect();

  const stats: Stats = {
    scanned: 0,
    withUrl: 0,
    updated: 0,
    skippedNoUrl: 0,
    skippedMissingJob: 0,
    skippedAlreadySet: 0,
    errors: 0,
  };

  console.log(
    "Starting source_url migration to Neon",
    JSON.stringify(
      {
        region: AWS_REGION,
        dynamoTable: DYNAMO_TABLE,
        overwriteExisting: OVERWRITE_EXISTING,
        scanPageSize: SCAN_PAGE_SIZE,
        maxItems: MAX_ITEMS,
      },
      null,
      2
    )
  );

  for await (const item of scanEnhancedTable()) {
    stats.scanned += 1;
    if (MAX_ITEMS && stats.scanned > MAX_ITEMS) break;

    const jobId = normalizeJobId(item.jobId);
    const url = normalizeUrl(item.source_url ?? null);
    if (!jobId || !url) {
      stats.skippedNoUrl += 1;
      continue;
    }
    stats.withUrl += 1;

    try {
      const result = await updateNeon(jobId, url);
      if (result === "updated") {
        stats.updated += 1;
      } else if (result === "already-set") {
        stats.skippedAlreadySet += 1;
      } else {
        stats.skippedMissingJob += 1;
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`Failed to update Neon for jobId=${jobId}`, error);
    }

    if (stats.scanned % LOG_EVERY === 0) {
      console.log(
        `Progress: scanned=${stats.scanned}, updated=${stats.updated}, errors=${stats.errors}`
      );
    }
  }

  console.log("Migration complete", JSON.stringify(stats, null, 2));

  await pg.end();
}

run().catch(async (error) => {
  console.error("Migration failed", error);
  try {
    await pg.end();
  } catch {}
  process.exit(1);
});
