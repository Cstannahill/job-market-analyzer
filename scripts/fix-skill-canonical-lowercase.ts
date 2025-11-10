#!/usr/bin/env ts-node

/**
 * Backfill: force skill_canonical (PK) to lowercase in the skill-trends-v2 table.
 *
 * PK:  skill_canonical  (String)
 * SK:  region_seniority_mode_period (String)
 *
 * Process:
 *  - Scan table
 *  - For items where PK !== PK.toLowerCase(), copy -> new key (lower), then delete old
 *  - Conditional put to avoid clobber if target already exists
 *
 * Env:
 *  AWS_REGION=us-east-1
 *  TABLE_NAME=skill-trends-v2
 *  DRY_RUN=true|false           // default: true
 *  CONCURRENCY=5                 // default: 5
 *  ADD_DISPLAY=true|false        // default: true (preserve original case as skill_display)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.TABLE_NAME || "skill-trends-v2";
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() === "true";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5", 10);
const ADD_DISPLAY =
  (process.env.ADD_DISPLAY ?? "true").toLowerCase() === "true";

type Row = {
  skill_canonical: string;
  skill_display?: string;
  region_seniority_mode_period: string;
  [k: string]: any;
};

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// simple pool
async function mapPool<T, R>(
  items: T[],
  n: number,
  fn: (x: T, i: number) => Promise<R>
) {
  const out: R[] = [];
  let idx = 0;
  const run = async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(new Array(Math.min(n, items.length)).fill(0).map(run));
  return out;
}

function normalizeLower(s: string): string {
  return (s ?? "").toLowerCase();
}

async function* scanAll(): AsyncGenerator<Row> {
  let ExclusiveStartKey: Record<string, any> | undefined;
  while (true) {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey,
        // If table is huge, project only keys + a few fields, but we want a full copy,
        // so we scan full items. If you want to reduce IO, add a ProjectionExpression.
      })
    );
    for (const item of res.Items ?? []) {
      yield item as Row;
    }
    if (!res.LastEvaluatedKey) break;
    ExclusiveStartKey = res.LastEvaluatedKey;
  }
}

async function processOne(row: Row) {
  const oldPK = row.skill_canonical;
  const newPK = normalizeLower(oldPK);

  if (!oldPK || !row.region_seniority_mode_period) {
    console.warn(`[SKIP] Missing key(s):`, {
      oldPK,
      sk: row.region_seniority_mode_period,
    });
    return { changed: false, reason: "missing-keys" };
  }

  if (oldPK === newPK) {
    return { changed: false, reason: "already-lower" };
  }

  // Build new item
  const newItem = { ...row, skill_canonical: newPK };
  if (ADD_DISPLAY) {
    // Persist original casing for UI
    newItem.skill_display = row.skill_display ?? oldPK;
  }

  if (DRY_RUN) {
    console.log(`[DRY] would rename:`, {
      from: {
        skill_canonical: oldPK,
        region_seniority_mode_period: row.region_seniority_mode_period,
      },
      to: {
        skill_canonical: newPK,
        region_seniority_mode_period: row.region_seniority_mode_period,
      },
    });
    return { changed: true, dry: true };
  }

  // 1) Put new item if it doesn't already exist
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: newItem,
        ConditionExpression:
          "attribute_not_exists(skill_canonical) AND attribute_not_exists(region_seniority_mode_period)",
      })
    );
  } catch (err: any) {
    if (err.name === "ConditionalCheckFailedException") {
      console.warn(
        `[CONFLICT] Lowercase target already exists, skipping put:`,
        {
          key: {
            skill_canonical: newPK,
            region_seniority_mode_period: row.region_seniority_mode_period,
          },
        }
      );
      // Don’t delete source; we’d lose data. You can later merge or decide policy.
      return { changed: false, reason: "conflict-exists" };
    }
    console.error(`[ERROR] Put failed`, err);
    throw err;
  }

  // 2) Delete old item
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: {
          skill_canonical: oldPK,
          region_seniority_mode_period: row.region_seniority_mode_period,
        },
      })
    );
  } catch (err) {
    // Non-fatal: we already wrote the good item. Log and continue.
    console.error(`[WARN] Delete old failed (manual cleanup may be needed):`, {
      key: {
        skill_canonical: oldPK,
        region_seniority_mode_period: row.region_seniority_mode_period,
      },
      err,
    });
  }

  return { changed: true, dry: false };
}

async function main() {
  console.log(
    JSON.stringify(
      {
        table: TABLE,
        region: REGION,
        dryRun: DRY_RUN,
        concurrency: CONCURRENCY,
        addDisplay: ADD_DISPLAY,
      },
      null,
      2
    )
  );

  let total = 0;
  let candidates = 0;
  let changed = 0;
  let conflicts = 0;
  let alreadyLower = 0;

  const buffer: Row[] = [];
  for await (const row of scanAll()) {
    total++;
    if (!row || typeof row.skill_canonical !== "string") {
      continue;
    }
    if (row.skill_canonical !== row.skill_canonical.toLowerCase()) {
      buffer.push(row);
    } else {
      alreadyLower++;
    }
  }

  candidates = buffer.length;
  console.log(
    `Scanned ${total} items. Candidates to rename: ${candidates}. Already lower: ${alreadyLower}.`
  );

  await mapPool(buffer, CONCURRENCY, async (r) => {
    const res = await processOne(r);
    if (res.changed && !res.dry) changed++;
    if (res.reason === "conflict-exists") conflicts++;
  });

  console.log(
    `Done. Changed=${changed}, Conflicts=${conflicts}, Candidates=${candidates}, DryRun=${DRY_RUN}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
