#!/usr/bin/env ts-node

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// ====== Config ======
const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.TABLE_NAME || "skill-trends-v2";
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() === "true";
const CLEAN_DUPES =
  (process.env.CLEAN_DUPES ?? "true").toLowerCase() === "true"; // delete uppercase after fixing
const FORCE_OVERRIDE =
  (process.env.FORCE_OVERRIDE ?? "false").toLowerCase() === "true"; // overwrite existing display
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "6", 10);

// ====== Types ======
type Row = {
  skill_canonical: string;
  region_seniority_mode_period: string;
  skill_display?: string;
  [k: string]: any;
};

// ====== AWS ======
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// ====== Helpers ======
const norm = (s: string) => (s ?? "").toLowerCase();

function titleCase(s: string) {
  return s.replace(
    /\w\S*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}

// Hand-tuned display casing
const DISPLAY_OVERRIDES: Record<string, string> = {
  aws: "AWS",
  gcp: "GCP",
  sql: "SQL",
  "sql server": "SQL Server",
  nosql: "NoSQL",
  graphql: "GraphQL",
  dotnet: ".NET",
  csharp: "C#",
  cpp: "C++",
  postgresql: "PostgreSQL",
  kubernetes: "Kubernetes",
  nodejs: "Node.js",
  nextjs: "Next.js",
  react: "React",
  vue: "Vue",
  s3: "S3",
  ec2: "EC2",
  dynamodb: "DynamoDB",
  mysql: "MySQL",
  mongodb: "MongoDB",
  powershell: "PowerShell",
};

function toDisplayFromCanonical(lowerPk: string, preferred?: string) {
  const key = norm(lowerPk);
  if (DISPLAY_OVERRIDES[key]) return DISPLAY_OVERRIDES[key];
  // If we have a preferred value and its normalization matches, preserve its casing
  if (preferred && norm(preferred) === key) return preferred;
  return titleCase(lowerPk);
}

function assertSameNormalized(pkLower: string, display: string) {
  if (norm(pkLower) !== norm(display)) {
    throw new Error(
      `Refusing to set mismatched display: pk=${pkLower} display=${display}`
    );
  }
}

async function* scanAll(): AsyncGenerator<Row> {
  let ExclusiveStartKey: Record<string, any> | undefined;
  for (;;) {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey,
        // Only fetch what we need to reconcile
        ProjectionExpression:
          "skill_canonical, region_seniority_mode_period, skill_display",
      })
    );
    for (const item of res.Items ?? []) yield item as Row;
    if (!res.LastEvaluatedKey) break;
    ExclusiveStartKey = res.LastEvaluatedKey;
  }
}

async function updateDisplay(lowerPK: string, sk: string, display: string) {
  if (DRY_RUN) {
    console.log(`[DRY] SET display`, { pk: lowerPK, sk, display });
    return;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { skill_canonical: lowerPK, region_seniority_mode_period: sk },
      UpdateExpression: FORCE_OVERRIDE
        ? "SET skill_display = :d"
        : "SET skill_display = if_not_exists(skill_display, :d)",
      ExpressionAttributeValues: { ":d": display },
    })
  );
}

async function deleteUpper(upperPK: string, sk: string) {
  if (!CLEAN_DUPES) return;
  if (DRY_RUN) {
    console.log(`[DRY] DELETE uppercase`, { pk: upperPK, sk });
    return;
  }
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { skill_canonical: upperPK, region_seniority_mode_period: sk },
    })
  );
}

async function mapPool<T>(
  items: T[],
  n: number,
  fn: (x: T, i: number) => Promise<void>
) {
  let i = 0;
  const runners = Array(Math.min(n, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    });
  await Promise.all(runners);
}

// ====== Main ======
async function main() {
  console.log(
    JSON.stringify(
      { TABLE, REGION, DRY_RUN, CLEAN_DUPES, FORCE_OVERRIDE, CONCURRENCY },
      null,
      2
    )
  );

  // Load
  const all: Row[] = [];
  for await (const r of scanAll()) all.push(r);

  // Group by (normalized skill + SK) so we only compare true variants
  type GroupKey = string;
  const groups = new Map<GroupKey, Row[]>();
  for (const r of all) {
    const pk = r.skill_canonical;
    const sk = r.region_seniority_mode_period;
    if (!pk || !sk) continue;
    const key: GroupKey = `${norm(pk)}|${sk}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  // Build tasks: for each group, find lower row and any uppercase variants
  const pairTasks: Array<{ lower: Row; uppers: Row[] }> = [];
  for (const [, rows] of groups) {
    const lower = rows.find(
      (x) => x.skill_canonical === norm(x.skill_canonical)
    );
    if (!lower) continue;
    const n = norm(lower.skill_canonical);
    const uppers = rows.filter(
      (x) => x.skill_canonical !== n && norm(x.skill_canonical) === n
    );
    if (uppers.length) pairTasks.push({ lower, uppers });
  }

  let fixedDisplay = 0;
  let deletedUpper = 0;
  let onlyLowerFixed = 0;
  let pairsProcessed = 0;

  // 1) For true pairs, set display on the lowercase item (using preferred casing), then delete the uppercase dupes (optional)
  await mapPool(pairTasks, CONCURRENCY, async ({ lower, uppers }) => {
    const sk = lower.region_seniority_mode_period;
    const preferred =
      uppers[0]?.skill_canonical ??
      lower.skill_display ??
      lower.skill_canonical;
    const display = toDisplayFromCanonical(lower.skill_canonical, preferred);

    assertSameNormalized(lower.skill_canonical, display);

    await updateDisplay(lower.skill_canonical, sk, display);
    fixedDisplay++;

    if (CLEAN_DUPES) {
      for (const u of uppers) {
        await deleteUpper(u.skill_canonical, sk);
        deletedUpper++;
      }
    }

    pairsProcessed++;
  });

  // 2) For lowercase-only rows, set display if missing (or override if FORCE_OVERRIDE)
  const lowerOnly = all.filter((r) => {
    const isLower = r.skill_canonical === norm(r.skill_canonical);
    if (!isLower) return false;
    if (FORCE_OVERRIDE) return true;
    return r.skill_display == null;
  });

  await mapPool(lowerOnly, CONCURRENCY, async (r) => {
    const display = toDisplayFromCanonical(r.skill_canonical, r.skill_display);
    assertSameNormalized(r.skill_canonical, display);

    await updateDisplay(
      r.skill_canonical,
      r.region_seniority_mode_period,
      display
    );
    onlyLowerFixed++;
  });

  console.log(
    `Pairs processed: ${pairsProcessed}, Lower displays set from pairs: ${fixedDisplay}, Uppercase deleted: ${deletedUpper}, Lower-only fixed: ${onlyLowerFixed}`
  );
  console.log(`Done.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
