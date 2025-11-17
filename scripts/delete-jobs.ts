import { Pool } from "pg";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import * as readline from "readline";
type DeleteWriteRequest = { DeleteRequest: { Key: Record<string, any> } };
// ---------- CONFIGURE THESE AS NEEDED ----------

// Neon / Postgres connection string
// e.g. postgres://user:password@host/dbname?sslmode=require
const PG_CONNECTION_STRING =
  process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL || "";

// DynamoDB region (should match where your tables live)
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// Table names
const PG_JOBS_TABLE = "jobs";
const PG_JOBS_TECH_TABLE = "jobs_technologies";

const DDB_ENHANCED_TABLE = "job-postings-enhanced"; // PK: jobId
const DDB_BASE_TABLE = "job-postings"; // PK: PK = JOB#<id>

// IDs to remove from Neon (Postgres)
const neonJobIds: string[] = [];

// IDs to remove from DynamoDB
const dynamoJobIds: string[] = [
  "69bbddabdcfba02c66dc0126b7d2fb7489a0ee44",
  "6786ebd77415272c54863cc98074c17cac63eda9",
  "065c6989516d82b9e5c75a67dc3a843d73143bd3",
];

// ---------- UTILITIES ----------

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// ---------- POSTGRES (NEON) HELPERS ----------

async function countPostgresMatches(pool: Pool, jobIds: string[]) {
  if (!jobIds.length) {
    return { joinCount: 0, jobsCount: 0 };
  }

  const client = await pool.connect();
  try {
    const joinResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM ${PG_JOBS_TECH_TABLE}
       WHERE job_id = ANY($1::uuid[])`,
      [jobIds]
    );

    const jobsResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM ${PG_JOBS_TABLE}
       WHERE id = ANY($1::uuid[])`,
      [jobIds]
    );

    return {
      joinCount: Number(joinResult.rows[0]?.count ?? 0),
      jobsCount: Number(jobsResult.rows[0]?.count ?? 0),
    };
  } finally {
    client.release();
  }
}

async function deletePostgresRows(pool: Pool, jobIds: string[]) {
  if (!jobIds.length) {
    return { deletedJoins: 0, deletedJobs: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deleteJoins = await client.query(
      `DELETE FROM ${PG_JOBS_TECH_TABLE}
       WHERE job_id = ANY($1::uuid[])`,
      [jobIds]
    );

    const deleteJobs = await client.query(
      `DELETE FROM ${PG_JOBS_TABLE}
       WHERE id = ANY($1::uuid[])`,
      [jobIds]
    );

    await client.query("COMMIT");

    return {
      deletedJoins: deleteJoins.rowCount,
      deletedJobs: deleteJobs.rowCount,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------- DYNAMODB HELPERS ----------

async function countDynamoByKeys(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  keys: Record<string, any>[]
): Promise<number> {
  if (!keys.length) return 0;

  let total = 0;

  for (const key of keys) {
    // Optional: log to see exactly what key/table is being checked
    // console.log("Counting in", tableName, "with key", key);

    const resp = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: key,
      })
    );

    if (resp.Item) {
      total += 1;
    }
  }

  return total;
}

async function deleteDynamoByKeys(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  keys: Record<string, any>[]
): Promise<number> {
  if (!keys.length) return 0;

  let deleted = 0;

  for (const key of keys) {
    // Optional: log each delete
    // console.log("Deleting from", tableName, "with key", key);

    await ddb.send(
      new DeleteCommand({
        TableName: tableName,
        Key: key,
      })
    );

    deleted += 1;
  }

  return deleted;
}

// ---------- MAIN ----------

async function main() {
  if (!PG_CONNECTION_STRING) {
    throw new Error("PG_CONNECTION_STRING or DATABASE_URL env var must be set");
  }

  console.log("=== Delete jobs from Neon + Dynamo ===");
  console.log(`Neon job IDs: ${neonJobIds.length}`);
  console.log(`Dynamo job IDs: ${dynamoJobIds.length}`);
  console.log("");

  // Init clients
  const pgPool = new Pool({
    connectionString: PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }, // Neon typically requires SSL
  });

  const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
  const ddb = DynamoDBDocumentClient.from(dynamoClient);

  try {
    // ---- COUNT PHASE ----

    // Postgres
    const { joinCount, jobsCount } = await countPostgresMatches(
      pgPool,
      neonJobIds
    );

    // Dynamo: build keys
    const enhancedKeys = dynamoJobIds.map((id) => ({ jobId: id }));
    const baseKeys = dynamoJobIds.map((id) => ({
      PK: `JOB#${id}`,
      SK: "POSTING#v1",
    }));

    const enhancedCount = await countDynamoByKeys(
      ddb,
      DDB_ENHANCED_TABLE,
      enhancedKeys
    );
    const baseCount = await countDynamoByKeys(ddb, DDB_BASE_TABLE, baseKeys);

    console.log("Planned deletions:");
    console.log(
      `  Neon / Postgres: ${PG_JOBS_TECH_TABLE} = ${joinCount} rows, ${PG_JOBS_TABLE} = ${jobsCount} rows`
    );
    console.log(
      `  DynamoDB: ${DDB_ENHANCED_TABLE} = ${enhancedCount} items, ${DDB_BASE_TABLE} = ${baseCount} items`
    );
    console.log("");

    const rl = createReadline();
    const answer = (
      await askQuestion(rl, "Do you want to proceed with DELETE? (yes/no): ")
    ).toLowerCase();
    rl.close();

    if (answer !== "yes" && answer !== "y") {
      console.log("Aborting. No changes were made.");
      return;
    }

    // ---- DELETE PHASE ----

    console.log("\nDeleting from Neon / Postgres...");

    const { deletedJoins, deletedJobs } = await deletePostgresRows(
      pgPool,
      neonJobIds
    );

    console.log(`  Deleted ${deletedJoins} rows from ${PG_JOBS_TECH_TABLE}`);
    console.log(`  Deleted ${deletedJobs} rows from ${PG_JOBS_TABLE}`);

    console.log("\nDeleting from DynamoDB...");

    const deletedEnhanced = await deleteDynamoByKeys(
      ddb,
      DDB_ENHANCED_TABLE,
      enhancedKeys
    );
    const deletedBase = await deleteDynamoByKeys(ddb, DDB_BASE_TABLE, baseKeys);

    console.log(
      `  Deleted ~${deletedEnhanced} items from ${DDB_ENHANCED_TABLE}`
    );
    console.log(`  Deleted ~${deletedBase} items from ${DDB_BASE_TABLE}`);

    console.log("\nDone.");
  } finally {
    await pgPool.end();
    // DynamoDB client doesn't strictly need explicit close, but:
    dynamoClient.destroy();
  }
}

main().catch((err) => {
  console.error("Error during delete script:", err);
  process.exit(1);
});
