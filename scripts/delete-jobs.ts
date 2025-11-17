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
  "3e2d9e8a-d959-412d-9f20-f21bbdcd1a3c",
  "e2bf33dc-13a3-48a0-a34e-0408c9f943a3",
  "9af9bc57-d288-4746-abb6-4fe8fc8bb19d",
  "c5e8294c-d838-4545-a242-76159a573cd1",
  "389da8d8-8606-4f47-acc2-b5a3099d8800",
  "ae94c841-7021-4dfe-a1c1-0ca75998878a",
  "e8fcaf43-ac75-40a6-aed3-e67ebbff571d",
  "ad04c975-5e67-4b34-85b6-3d8ae2d20dcb",
  "3b41fdf8-34f7-494e-b9c4-848fbd452c33",
  "808ec2c9-e44b-40a4-ab07-e7c70463a1d7",
  "11fdd5d6-4025-41d4-bef8-d920a1381fac",
  "c3677b3c-276b-4de2-ab06-c0000e7e1fc7",
  "c5f88bcf-428f-4427-b676-f2441639ffbb",
  "6b5a6b53-df03-4ea4-aa62-7703d97a76a1",
  "7c443475-78b9-4cb1-a714-d4c41e7c2d45",
  "43849e97-9d82-4fab-8faa-4fb37bf61dec",
  "14192af1-f46b-445c-bff4-f10f8c9a60dd",
  "976b5f6f-1021-4106-901c-a4fa3be7e4ba",
  "be7c626f-a2b0-4246-b8ee-489c9f255094",
  "c9a4d046-58cd-4ef5-8e24-4b031b44aae3",
  "ab83551d-289e-4e17-b06f-c6d562dca098",
  "6a3dee59-ccf0-4449-8d01-bf6609d7dfff",
  "9649d67d-0203-4d11-9bcf-63591dc1c457",
  "54f905cc-5325-4700-838c-f0f05e80c594",
  "63dc05ec-d526-4c19-a8c0-1528a87e3517",
  "ff91afa0-2a19-46a1-ab1c-7ff5cee08064",
  "6b14bc13-46f2-4fba-bdc6-3988d1a73121",
  "bcd9f82e-c878-4fd0-9290-fd51f7a045ac",
  "991a24aa-3861-4918-bb26-f006cba66ca9",
  "729b8854-76c2-4c01-84fd-2f01c88ed8f1",
  "5de934a2-4d50-4312-bdc3-2398a4c40654",
  "17e04919-be07-4f46-a472-62a9c322cc78",
  "69401e7c-0bd3-4606-8bbf-3557f7d0fde9",
  "77d68bba-d0b1-47c0-8c3d-eca15c4a7fea",
  "879c4fd7-68dc-42cc-845d-b4e4eb6020fc",
  "6669ce7c-c046-44bb-aa80-b57425b0bf10",
  "0210b2df-84b0-4214-8c84-eb517e17bb50",
];

// IDs to remove from DynamoDB
const dynamoJobIds: string[] = [
  "3c2b2ab5e4b5bad53aa564d8c8660e883cc2b08a",
  "8dfd1b2f524517512a533c313ab055a54888c472",
  "9a4c8758be0ec690514459217306ce7fb4835eac",
  "921fcc972be9ac6bf8f843a8f37dac76071e600b",
  "81ad829cfdb87195187c237e7c9e650f2e8324d5",
  "2b50fc9fb07b4c763c9214414f15379305e08639",
  "743c6d70e2ad1aa58e8e904fa15899c1146ed445",
  "41df6b6432aec75aff7972c8d622407bf7fd311e",
  "4c7bf2408e610d4cce3654199155943b0509ec2d",
  "cf3acd56e65463e0bae83b1a6b22600eb9041df3",
  "c841b6e92cdcb00cf736a918ae064399d99032f5",
  "fc1508cb3b446e834eaa59a3ba17fa39663b9a1d",
  "50e71710a64362c6d3cf668c2fab41d2b08af034",
  "f41ff3ffb11773f81e17b76038f7a84e864e329d",
  "e2213ba1d16b757e7c2c6c75ec91c43776594cca",
  "599a901bbf486677d057cb7f3e83138508e47a76",
  "b13a3e760319dca82228996b79d9fbdb79617120",
  "9d3bfdc929d1690cbf8f066224392e3785653c82",
  "1d6274f7eac7544f3b254215dbe435bc222ef4e8",
  "77ae1fd056ceee8ebb80d00419b0909e131da5d7",
  "0883dd6a86e8765035d29dc0dc27bc6d84bc1442",
  "601588b1250988b21da17afebb9893abed51fb38",
  "1b05eb43aa590d3ccbce668d5d9d7533e602ca0f",
  "61d592b68ebc844045a14271999741f888ead8c5",
  "b0ca5625bdf7dd9a3e25316ef26baf93dd4621b2",
  "b9b00798571ebbabc047b00b7d99d39bb5f8c469",
  "9182e5aca2cb320bb9e5b653fbf00d4a29ceb3f3",
  "d8fef771bfcfc221dd117e4757a30280b06a7ae0",
  "0b480c4adea2f6da810d71b31e1bc3fb1885a49d",
  "860f8d87c756315cc0c8ad5416df504ff09dd801",
  "0b480c4adea2f6da810d71b3189fa62aa35a7371",
  "8e45bf85bbb2fbb4a298c1889012e2166dfd9c06",
  "331e4c02c7fb07f02b592a2c732fd5c6fda43ec8",
  "9031418226ec9cf6f04316510e12147c368d0d71",
  "822f3cf047c9b143a09fb61e35c5559a49745218",
  "e8201d8b980a0d56e6c34e886d2e0ae3a25d1f32",
  "b6d1cf8d1e0ab7ab93cce63645fa9cd610c32faf",
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
