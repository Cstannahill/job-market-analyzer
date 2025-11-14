#!/usr/bin/env ts-node

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Client as PgClient } from "pg";

const DYNAMO_TABLE = "job-postings-enhanced";
const NEON_CONNECTION =
  process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const BATCH_SIZE = 25;

if (!NEON_CONNECTION) {
  throw new Error(
    "DATABASE_URL (or NEON_DATABASE_URL) is required to run this script."
  );
}

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: AWS_REGION,
  })
);

const pg = new PgClient({
  connectionString: NEON_CONNECTION,
});

type DynamoItem = {
  jobId?: string;
  remote_status?: string;
};

const REMOTE_MAP: Record<string, string> = {
  remote: "remote",
  "remote-first": "remote",
  "remote first": "remote",
  hybrid: "hybrid",
  "hybrid/remote": "hybrid",
  onsite: "on_site",
  "on-site": "on_site",
  "in-office": "on_site",
  "not specified": "not_specified",
  unknown: "not_specified",
};

function normalizeRemoteStatus(raw?: string): string | null {
  if (!raw) return "not_specified";
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "not_specified";
  for (const [pattern, mapped] of Object.entries(REMOTE_MAP)) {
    if (normalized === pattern) return mapped;
  }
  if (/remote/.test(normalized)) return "remote";
  if (/hybrid|flex/.test(normalized)) return "hybrid";
  if (/on[\s-]?site|onsite|office/.test(normalized)) return "on_site";
  return "not_specified";
}

async function* scanDynamo(): AsyncGenerator<DynamoItem> {
  let ExclusiveStartKey: Record<string, any> | undefined;
  while (true) {
    const res = await ddb.send(
      new ScanCommand({
        TableName: DYNAMO_TABLE,
        ProjectionExpression: "jobId, remote_status",
        ExclusiveStartKey,
      })
    );
    for (const item of res.Items ?? []) {
      yield item as DynamoItem;
    }
    if (!res.LastEvaluatedKey) break;
    ExclusiveStartKey = res.LastEvaluatedKey;
  }
}

async function updateBatch(batch: Array<{ jobId: string; status: string }>) {
  if (batch.length === 0) return;
  const values: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const { jobId, status } of batch) {
    values.push(`($${idx++}, $${idx++})`);
    params.push(jobId, status);
  }

  const sql = `
    UPDATE jobs AS j SET remote_status = v.remote_status::remote_status
    FROM (VALUES ${values.join(", ")}) AS v(dynamo_id, remote_status)
    WHERE j.dynamo_id = v.dynamo_id
  `;

  await pg.query(sql, params);
}

async function main() {
  console.log("Connecting to Neon...");
  await pg.connect();
  console.log("Connected. Scanning DynamoDB table:", DYNAMO_TABLE);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let batch: Array<{ jobId: string; status: string }> = [];

  for await (const item of scanDynamo()) {
    processed++;
    const jobId = item.jobId;
    if (!jobId) {
      skipped++;
      continue;
    }
    const normalized = normalizeRemoteStatus(item.remote_status);
    if (!normalized) {
      skipped++;
      continue;
    }
    batch.push({ jobId, status: normalized });
    if (batch.length >= BATCH_SIZE) {
      await updateBatch(batch);
      updated += batch.length;
      batch = [];
      if (updated % 500 === 0) {
        console.log(`Updated ${updated} records...`);
      }
    }
  }

  if (batch.length > 0) {
    await updateBatch(batch);
    updated += batch.length;
  }

  console.log("Done.", { processed, updated, skipped });
  await pg.end();
}

main().catch((err) => {
  console.error("Script failed", err);
  process.exit(1);
});
