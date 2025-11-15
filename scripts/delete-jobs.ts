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
  "9d07583c-ac3d-46c4-b7a9-35e71724e953",
  "4d411b61-5ea6-4889-a4ae-70015faae792",
  "3e4370b5-2cd4-4d0d-9315-35b897862008",
  "de12017b-f507-447c-a67e-b7e68070be42",
  "aa482725-6c1b-4e2a-b09f-266043321541",
  "c90c8fd7-5886-4316-b0fb-142a9dd4b010",
  "bcf316cf-6e25-464c-892b-ef931e3bc200",
  "2d3daada-9ce1-466e-b42b-ed50b42c5d4c",
  "ed098ed5-b49e-478e-a54f-2dd611a87ad4",
  "f058b13a-bb4b-492d-8c00-2f064fd494f2",
  "46887241-c84a-4e5a-8c2b-117089b44f7c",
  "25c1c620-6b32-48b8-a7a2-d7315e2f4c07",
  "91e2f3f8-e90e-43c9-862f-3157af8a910c",
  "21e71922-8cc5-4b0e-abf3-6b0a48fd3521",
  "8469f735-4b67-4bef-96bb-8586b3e35d9f",
  "320eedc5-c823-4d4e-b78f-dcb7b785d3d3",
  "90d7af47-c7ec-491e-9261-6048fc65eba3",
  "4baa1694-490b-45e7-b783-11e2a4c16f68",
  "c49d5d9d-f1c4-44eb-ad37-3a211cd829a4",
  "5119393d-cd60-44c9-b1ea-58559e518603",
  "c5773f5d-a5b4-477e-bcc2-7643d644f77b",
  "6ad7e3c7-5590-409a-a8dd-ad2291415dac",
  "e3fe4c92-3d69-4198-a7b2-9062965f7148",
  "789793b9-8655-4c83-bd21-6362e141a2c6",
  "469427a4-85e7-45de-b8be-bbef77927e00",
  "de502a2d-c225-4d16-afc9-f3c0ee65faa2",
  "7d7717bc-9f02-4e5f-a71d-17eb8a24e0cc",
  "229b5fd3-be6c-40a0-b5dd-289033f85832",
  "9523a6d4-bef3-4d17-aa70-74f591eb0162",
  "65ae152b-85aa-4ee3-92c1-2653f66bf722",
  "d54e2009-f7e0-4f21-8581-edf5568109ce",
  "1909322e-4af4-40f3-91cf-1a36318f9218",
  "69bc707c-4842-45ca-b124-504b32b265c4",
  "4c253070-355f-4d3b-a831-9ea14c05a32b",
  "24c88425-a2ec-493b-8ed5-c44b62a3c87d",
  "e2f1d83a-7c99-4b70-b498-a7a0c48cd5bf",
  "2a10d23c-bd4b-4ede-8bff-05b57aedb42f",
  "9c24fe08-337f-4f6f-acac-75fe8bd996e7",
  "35b79139-346b-47a3-8826-5daabb735a26",
  "fb8327dd-7661-4144-aafb-e0aeeddc0d9c",
  "421220fd-39c1-459c-98c6-aeabbb789ae2",
  "f906805c-48dd-410e-8f0c-7b23a23313cd",
  "d30d2ebc-59e9-42b5-9593-e4a8068452f8",
  "8febc127-148b-4577-b1dc-c379478ae1ca",
  "d82f1ff2-7187-4c7b-ba73-bf66957b0718",
  "edbc7ed2-a319-4100-9ea1-c2c463f8c823",
  "520d033e-f7dd-454f-9112-56814cde0996",
  "2904c398-61bd-4ee3-9bb5-adc957b6dc31",
  "bc9e62ea-6567-4289-9b1b-44a4e5b11793",
  "455a96e0-ad0f-4d58-8b7a-e1c389c265e6",
  "24828aec-2c09-4b2e-9684-973960fe1b0d",
  "7eaf90f0-ae9a-4081-ba67-9721c077823a",
  "80ba5964-259c-48e7-ae2f-bfbbe363d37f",
  "dabc17c8-548b-4ce4-b363-bc4626804758",
  "4d76d2c1-5d65-4dff-aa0c-35bafc09fc2b",
  "201247ab-e4ac-4a97-ac16-576675d0bc1e",
];

// IDs to remove from DynamoDB
const dynamoJobIds: string[] = [
  "63a561e337a339921c9b1371ae048028d2e46511",
  "0d2b66d0742afc44eec499a9a482a5f3c5c0be94",
  "1af780ae4096c8b32da2f7bd8d3e72601c2728e1",
  "982dc72a341b343ac700a5f9591f6a3bf442cae8",
  "734cd9ddc35209282d36771c99eb5070add04d9c",
  "85203988c6e6998240fd777b298daa88829c166e",
  "a1cde4c7baa5c2780edb03199dac4e764ac66f5b",
  "977bd81870a4cf210801fc4c6cca516866a24ca1",
  "11b0a210a7a951371ceca8232bbd30783f625f78",
  "1218f9ec0f246aaad73b17efea2034aaa941fbdf",
  "7177f7548b37f689b4d91cc77336122c643c3c84",
  "33be85bc2c7753068cd63325f969fa0710cc2ac2",
  "e31c0edf01f88f1c99508745cd663c603bb8a14a",
  "098060464ac6972d6dc3a2977225b94068799958",
  "1fa326be611ed89bbeb92e504ee7899ebb7b1f9d",
  "5cfb0c78be63d2775ca9d8f4c90e52286783dd02",
  "404ea818144e78a664587b79e1725d21ef6004e1",
  "7b7cbb1d794aee86601f5dacd643b83327160dc1",
  "7180a64cfcc331c4e74373590754feee5ee00f68",
  "f70951817e57d0dbec36113f6c93b2edfe68fba9",
  "8720a12eb76a9dfc4c86753c565da9e9be8d9c04",
  "eaab1ad05df47efea3f12a1afb420cc9a7e2c49d",
  "muse-19043578",
  "7bf7df4cf5188b209906fbc1a4aae62c01d3eed9",
  "49f7fbafea057c02d390c3853d11d340fcc1354c",
  "muse-19043516",
  "f059051be12b754f0395a211817db3ced262599b",
  "c75ba8f70d91610baea7e596c2ed093860be1175",
  "5121b10380c04ab012aac6bd65dacfbe68076cad",
  "ae5f586ca21be0c1363194be6a930a454cbd7285",
  "b42aa581d356c71f68b0e4f475d97bdbfc217b47",
  "cfcfc74e59677e449c5229726b2500fee2272352",
  "ec52102582c9790f2e6bdf314c37830aa05fda7d",
  "a08223e61832cb5f71422608b66f3dd932649ad9",
  "b6e26cf6ec326a0cf4da7e2921ea1e8cfddc08e0",
  "d56b55dc927a2c951b8a0c67452169860a5399aa",
  "908da815dd59fff1ad0a77c29d7362abb95e8c0e",
  "448ef87ae6f6b41ab9cc974497719fdbd6ff537d",
  "5f77cd6391a1d3fe6d7662a912de4dd5e237162e",
  "b8b47337ce6a92379d73d5eb046313e231d896f6",
  "83cd0749b3fb4f0976609a9f08fee74aec00292e",
  "138d4e9bb477438ce1d38ff11713a82cc835cc95",
  "ff9c7affadd8825a20334e2c6f2dbe49e3876ec0",
  "3f0969ffe2d1dcb9249de0ed1379456267aa1a59",
  "d2dbc5e69ce3b528e624e92c4065f85cf1d3b166",
  "06327d6969337f2a9306e9d8978116e985f1723c",
  "87bd274cffd350a81c09dc05ae9d6b20e08706e1",
  "361abf0bfe7fbc7b3db70c7ffc24cb6068b2ba09",
  "4101a670738f8cc1aa3a80d826c20d23b5cbf5a3",
  "279c6e5a857b4f74610873a9530d363a964dc3bc",
  "f796a94e8b3f4cc6fba209820fd57031460d71d3",
  "531125b06bbb6c11b09a1b62718858e83b363312",
  "02b602b4d841ae6048469d4592e6dd8bfe3757e5",
  "96d33884e5de88c73be0624632987aed8547a607",
  "f4d9fdc5a95826fab1c1e53f4cb72cd84891a0d5",
  "29377e0cfc228722e2674d694a7ac12afa1b70c7",
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
