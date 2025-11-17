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
const neonJobIds: string[] = [
  "6c4f453c-33f9-4d5e-b968-0014b9b2bdb1",
  "ee969641-d56c-492f-8c46-5586a1ec1c55",
  "63bfffef-baf4-4420-b26a-3e667f035a0f",
  "9af84626-80d5-40f3-a28f-d079a3fd70e0",
  "8b271fd3-c85c-4c20-8b38-fd29074e8e4c",
  "37393bdb-7eab-45ab-a6a2-34209c2971e9",
  "200e6f41-e33d-449a-98ea-091d18493e9a",
  "10171a41-dc66-4dc0-8d10-d59bf3c840f3",
  "ffa6b766-d851-4232-a77f-934a5cf6542f",
  "c5b3a435-1b82-4266-afda-74e20f98fcd4",
  "8073c8c0-c72d-4f45-a811-c6937a6a5915",
  "5ae59241-d60b-4fc3-a477-8795b382b781",
  "3d2661bd-f153-4903-ae46-bfe7c5a06201",
  "d1c11531-b276-40b3-858e-fa7d7ae59f13",
  "310c2c37-0b69-4be4-82e4-282e05966dca",
  "4c172b78-1f2a-416e-ab37-70c361a2b6f4",
  "c7f7d8c3-add3-4165-9b9e-13f618310726",
  "5ff2b5e4-4ec8-4f05-970f-d51635510578",
];

// IDs to remove from DynamoDB
const dynamoJobIds: string[] = [
  "601588b1250988b21da17afebb9893abed51fb38",
  "1b05eb43aa590d3ccbce668d5d9d7533e602ca0f",
  "8dfd1b2f524517512a533c313ab055a54888c472",
  "a301588eeaafb87970b6cf81874f0527239d7c1e",
  "b9b00798571ebbabc047b00b7d99d39bb5f8c469",
  "61d592b68ebc844045a14271999741f888ead8c5",
  "d008a9a69de6567b62d4f8ca21460c5fe176e79d",
  "1d6274f7eac7544f3b254215dbe435bc222ef4e8",
  "4cee734a8c0b3abcb3a1766caa342a7bb9e0a4f3",
  "5b3b49c3686bae77b416f61963c54401d8f0efc8",
  "8e45bf85bbb2fbb4a298c1889012e2166dfd9c06",
  "9031418226ec9cf6f04316510e12147c368d0d71",
  "22fc133fc0e8502741caa86bffcb0d5df54f862c",
  "860f8d87c756315cc0c8ad5416df504ff09dd801",
  "bb12585a36ee9ec497103a7929691d574ecbb763",
  "822f3cf047c9b143a09fb61e35c5559a49745218",
  "b6d1cf8d1e0ab7ab93cce63645fa9cd610c32faf",
  "5d0a539221fd83b97a231a147a02c09f9eb524f4",
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
