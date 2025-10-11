import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  GetItemCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const TABLE_NAME = process.env.TABLE_NAME || "job-postings-enhanced";
const CONCURRENCY = 10; // Number of parallel DynamoDB checks

if (!BUCKET_NAME) {
  throw new Error("BUCKET_NAME environment variable is required");
}

interface LambdaEvent {
  dryRun?: boolean;
  testJobId?: string;
}

interface LambdaResponse {
  statusCode: number;
  body: string;
}

// Extract jobId from S3 key (e.g., "muse-10274163.json" -> "muse-10274163")
function extractJobId(key: string): string {
  return key.replace(/\.json$/, "");
}

// Batch items into chunks of specified size
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Get all S3 object keys
async function getAllS3Keys(): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      keys.push(
        ...response.Contents.map((obj) => obj.Key!).filter((key) =>
          key.endsWith(".json")
        )
      );
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

// Check if a single jobId exists in DynamoDB
async function checkJobExists(jobId: string): Promise<boolean> {
  try {
    const command = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        jobId: { S: jobId },
      },
      ProjectionExpression: "jobId",
    });

    const response = await ddbClient.send(command);

    // Log first few checks for debugging
    if (Math.random() < 0.01) {
      // Log ~1% of checks
      console.log(
        `Sample check for ${jobId}:`,
        response.Item ? "FOUND" : "NOT FOUND"
      );
    }

    return !!response.Item;
  } catch (error) {
    console.error(`Error checking jobId ${jobId}:`, error);
    return false;
  }
}

// Check which jobIds exist in DynamoDB using GetItem (more reliable than BatchGetItem)
async function checkExistingInDynamoDB(jobIds: string[]): Promise<Set<string>> {
  const existingIds = new Set<string>();

  // Process in batches to control concurrency
  const batches = chunkArray(jobIds, CONCURRENCY);

  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (jobId) => {
        const exists = await checkJobExists(jobId);
        return { jobId, exists };
      })
    );

    results.forEach(({ jobId, exists }) => {
      if (exists) {
        existingIds.add(jobId);
      }
    });

    // Log progress
    if (batches.indexOf(batch) % 10 === 0) {
      console.log(
        `Checked ${batches.indexOf(batch) * CONCURRENCY} / ${
          jobIds.length
        } items`
      );
    }
  }

  return existingIds;
}

// Delete S3 objects in batches
async function deleteS3Objects(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;

  const batches = chunkArray(keys, 1000); // S3 delete limit
  let deletedCount = 0;

  for (const batch of batches) {
    const command = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: batch.map((key) => ({ Key: key })),
        Quiet: true,
      },
    });

    const response = await s3Client.send(command);
    deletedCount += batch.length - (response.Errors?.length || 0);

    if (response.Errors && response.Errors.length > 0) {
      console.error("Delete errors:", response.Errors);
    }
  }

  return deletedCount;
}

export const handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  try {
    console.log("Starting S3 cleanup process...");
    console.log("Table name:", TABLE_NAME);
    console.log("Bucket name:", BUCKET_NAME);
    const dryRun = event.dryRun || false;

    // Verify table exists and get key schema
    try {
      const describeCommand = new DescribeTableCommand({
        TableName: TABLE_NAME,
      });
      const tableDesc = await ddbClient.send(describeCommand);
      console.log(
        "Table key schema:",
        JSON.stringify(tableDesc.Table?.KeySchema)
      );
      console.log("Table item count:", tableDesc.Table?.ItemCount);
    } catch (error) {
      console.error("Error describing table:", error);
    }

    // Step 1: Get all S3 keys
    console.log("Fetching S3 objects...");
    const s3Keys = await getAllS3Keys();
    console.log(`Found ${s3Keys.length} objects in S3`);

    if (s3Keys.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No objects found in S3 bucket" }),
      };
    }

    // Step 2: Extract jobIds from S3 keys
    const jobIds = s3Keys.map(extractJobId);
    console.log("Sample jobIds:", jobIds.slice(0, 5));

    // Test a single known good jobId if provided
    if (event.testJobId) {
      console.log("Testing specific jobId:", event.testJobId);
      const testExists = await checkJobExists(event.testJobId);
      console.log("Test result:", testExists);
    }

    // Step 3: Check which jobIds exist in DynamoDB
    console.log(
      `Checking DynamoDB for existing entries (concurrency: ${CONCURRENCY})...`
    );
    console.log("First checking a sample of jobIds for debugging...");

    // Check first 5 jobIds with detailed logging
    for (let i = 0; i < Math.min(5, jobIds.length); i++) {
      const testId = jobIds[i];
      console.log(`\n=== Testing jobId: ${testId} ===`);
      try {
        const command = new GetItemCommand({
          TableName: TABLE_NAME,
          Key: { jobId: { S: testId } },
        });
        const result = await ddbClient.send(command);
        console.log(
          `Result for ${testId}:`,
          result.Item ? "FOUND ✓" : "NOT FOUND ✗"
        );
        if (result.Item) {
          console.log("Full item:", JSON.stringify(result.Item, null, 2));
        } else {
          console.log("Item was null/undefined");
          console.log("Response metadata:", result.$metadata);
        }
      } catch (err) {
        console.error(`Error testing ${testId}:`, err);
        if (err instanceof Error) {
          console.error("Error name:", err.name);
          console.error("Error message:", err.message);
        }
      }
    }

    console.log("\n=== Starting full check ===");
    const existingJobIds = await checkExistingInDynamoDB(jobIds);
    console.log(`Found ${existingJobIds.size} entries in DynamoDB`);

    // Step 4: Filter S3 keys that exist in DynamoDB
    const keysToDelete = s3Keys.filter((key) =>
      existingJobIds.has(extractJobId(key))
    );
    console.log(`${keysToDelete.length} S3 objects match DynamoDB entries`);

    if (keysToDelete.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "No S3 objects found that exist in DynamoDB",
          totalS3Objects: s3Keys.length,
          totalDynamoDBEntries: existingJobIds.size,
        }),
      };
    }

    // Step 5: Delete matching S3 objects (or dry run)
    let deletedCount = 0;
    if (dryRun) {
      console.log(
        "DRY RUN: Would delete the following keys:",
        keysToDelete.slice(0, 20)
      );
    } else {
      console.log("Deleting S3 objects...");
      deletedCount = await deleteS3Objects(keysToDelete);
      console.log(`Deleted ${deletedCount} objects from S3`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: dryRun
          ? "Dry run completed"
          : "Cleanup completed successfully",
        totalS3Objects: s3Keys.length,
        totalDynamoDBEntries: existingJobIds.size,
        objectsToDelete: keysToDelete.length,
        objectsDeleted: deletedCount,
        dryRun,
        sampleKeysToDelete: keysToDelete.slice(0, 10),
      }),
    };
  } catch (error) {
    console.error("Error during cleanup:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error during cleanup",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
