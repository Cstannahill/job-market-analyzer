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
  "6785eaecad6d49d52191db78722d6e51a2635a99",
  "237d083ae938e85c5f4feed62a22b650ff2192be",
  "62bbfa02c4669e93e87cf36c6b0b6d5115041bab",
  "8e8b2adabe828c7d728b6d6a98999140025c9ecd",
  "354277a78af89af34d4c881d6990e7af004c64ac",
  "8a70b38d08580043c0ba506aa6ea083d3334b382",
  "3ed2806a52bf23f5ffb60f04e4a7c70cbf461af0",
  "ba6aa3ba54ddd07880f131feec7f1e3f52f96fab",
  "275e7229bb130f2a1a217c5b4066847f227cade8",
  "167707470dc14a2f17daa52461325b51b34589d3",
  "0b158599d2a217d604ecc9c96bae45d1b68d2cdf",
  "1795f31013e8c742f71c91546caba0502b1244d2",
  "22e8acb50463a653dbb2f7430fa250944e882428",
  "9e1351781bc41f7a120c1d3f67908ae24c0a080c",
  "ff04c383c7ff15ade3ab2b807867cdde09bd21f5",
  "42d7240a0fbc225920b6f698d0293757b94ed11d",
  "5e8220401d29c744d89abf2e69164d27e892ca0a",
  "a86ee5c920fa292b672081cec6ecc26b83925db3",
  "dfb1d8519dc30e4584c4f66da58f7a839084beca",
  "ca875c2aafca2fd2b6d1ce852064da015a8a2917",
  "171706fdda3793a8b584469f533d5db2214ce626",
  "44cdc8d50b0a0bbfa6f47809c7140c5316b3e696",
  "26987e7c7dc31c34812ded09e148261e62f83ad6",
  "70d4570e02323a61324db43b2f428d3e8f089dc5",
  "272890b93ec7e8410e836835ddd4f0d795536483",
  "04c94bdf38a5e3e21b20b3555219f081b5750ef3",
  "bfafa0f92d03cb3e2130ab419e4532bd64c302f9",
  "6a3d14f4acc664041ec28bb131556bbdb293400f",
  "2b5b4a072c773b843b3465156bd18ed1a92b2e7f",
  "63d7add8b3f1ba2eea32d2354469d0baca512d84",
  "591d5c82fb2c4334d485cc271cfef57abe3eb85a",
  "75a1bbb060460c6d9559c8dde366721bc4f4c39b",
  "d556af0074e2c012ce2bd2de0d7c399a7b86e7f5",
  "9e918f708af1e3c3afcd44727b563ed7d264f12d",
  "9e711d8cbfb0c719c149d9be2575ad0f1167e2b0",
  "faea3f10504a830efb91a8c1e00edf80587c4333",
  "a1fc53592683290a3533cc4a9fb1204024bd5db3",
  "85627710ae302a07f70d1e9bd46f7e6e70f4dd70",
  "d549cce510fc8bfdc91eb4fa875025b7f7983145",
  "c998ae24f7f6f608a8f22ba86d7e800b611c5fa4",
  "44892db907445c7326d299cd4df0fb3f4ac4337a",
  "e9d24501cb1535976a3db6368a4461ef4b9a2903",
  "b937e4e096136714c1780825a94dedb11244ddd8",
  "raw/greenhouse/2025-10-28/594d0379173ba6314dae7696dbc803d12b93f7cc",
  "ef65523e39fec95e295dea9d9235977f7ba50a43",
  "b8d9965a2a30fc847e71b3657c3f890f1f6be0c0",
  "99d061fa703194183ba79e1f8d5547abec57786f",
  "3c94f0ad8247e9df6c33c35f6ca79dce72f09d73",
  "a007292667da5277bee4cec26ba23fe3b14487e8",
  "c2af9df3a6722f95af9b68375ec15a500d53ad2e",
  "muse-19010766",
  "8a8c6d43e14e3f6904eaf619ec1080d16443c871",
  "afd033a4714780b02a0937ad8e5f653021c37ea5",
  "39d6dd7e3e58a714dff602ab36bd66172f4f3e0f",
  "b5a8a9b63c66f988d7f0ff7f4808d4160994e04e",
  "dcff73a55604355232fe680c6e8823d1adcc471e",
  "8ea3d0d36ea580f7316c970fb623faf881a70985",
  "132ab90ba48e0e7068961cae15428bf549d51639",
  "32baca724ebb9862639f2269c39ed29fa008fd82",
  "656dc84ad14a76c0fe62ff6dd6d8f2101476b712",
  "acf9bced95c17912199c608e240d2f75c9f057d0",
  "768b0a63f9532da9cbc112beb3c32e6965ff0cdf",
  "02bd5334a021e3b915cc3029ee4427df962b24d4",
  "6823e921b8c35774eb7832e2678442f98c9e118a",
  "dc743f74f7f91264754e5562304a0bde441f3f27",
  "de31c6de56c5ae91bc3064dd87d2dc43b5ae8250",
  "0aae3f68812e61b7c9385780d8b1d2d6c7090284",
  "be5ca2d5b123867c22537ef0dda1c050d1fe8905",
  "76737b7e2d446b5a5cedbb5da575658ddd6c9de3",
  "ecc6f33d4ae0dc1a62348f8de7c1e3132b9f30d8",
  "4c609c17760bc0fbf18acaa451d1ab26a2daaa0d",
  "eb4f3d01b45f53222f851e74b0a3dccb4ea1c0b7",
  "dd1b37033fd2914a426ba39601a782ec424864db",
  "b1d9056d707454b217b24f551a4e70bd7a063987",
  "a2ceac8b287e3e7a6e09728446fe65e8bcf15d57",
  "b178c51109ef2011d502231452da7967b7e58666",
  "9d53a61607dd9f249892b77bf1e88720e7b3406e",
  "b1dd4d464c8b65259779a5bd9749e1348a02a044",
  "e1100d6ea587048d3b54f2a71f43123234c686d0",
  "9e2bff8bf5905ce2df365fd0e0a81779e9cd1b4f",
  "1ac121e60af55d2c12e2a20b6b326843726eca30",
  "3375e85556c3ceb38d2b9602fc2c5b0ce0e8ea60",
  "muse-18996053",
  "097f065ccf503248654bd4d817ccdba79f25e629",
  "muse-19010729",
  "51707cc242800eb7103965c7153ea6705fb60929",
  "e634461ef33b89c1428538cf78a2ad33f159d3d0",
  "8b855b1a5b4d80149114fb96137980ffb551b398",
  "muse-18999927",
  "34ba1403e73f5ff94294658c0fbd0716c4c89553",
  "3e6801f0f337318608f00723d821dc0ec17c49e6",
  "bd8a75546a57abbaf97bba0dde3d5f3f3db2b637",
  "3ec53db06a7bb3359b4120034f94aabbb9bec8ad",
  "muse-19260463",
  "f90320a60eb2a9d45d445ef9bcf7ef8e6a5f32d4",
  "df0acaf15c1a4d2ba75152ceb5adbba0054051f4",
  "muse-20035092",
  "b4ac142a969a04b66e434c26268bf3971070a987",
  "1e2fbaea238e7af30cc6dffc30f3491aa0b6a123",
  "3048c8d92d4737e42279332d493cfd97e79f04d2",
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
