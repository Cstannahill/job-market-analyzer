import {
  fetchPendingJobPostings,
  markPostingAsNormalized,
  type DynamoKey,
} from "./dynamoService.js";
import { upsertNormalizedJob } from "./neonService.js";
import { normalizeDynamoJobPosting } from "./normalizer.js";
import type { DynamoJobPosting } from "./types.js";

type MigrationSummary = {
  processed: number;
  skipped: number;
  failed: number;
};

function summarize(results: MigrationSummary) {
  console.log("=".repeat(60));
  console.log("Migration summary");
  console.log("=".repeat(60));
  console.log(`Processed: ${results.processed}`);
  console.log(`Skipped:   ${results.skipped}`);
  console.log(`Failed:    ${results.failed}`);
}

function resolveDynamoKey(posting: DynamoJobPosting): DynamoKey | null {
  if (posting.jobId) return { name: "jobId", value: posting.jobId };
  if (posting.Id && typeof posting.Id === "string") {
    return { name: "Id", value: posting.Id };
  }
  return null;
}

export async function migratePostings(): Promise<boolean> {
  console.log("Fetching pending job postings from DynamoDB...");
  const postings = await fetchPendingJobPostings();

  if (postings.length === 0) {
    console.log("No pending postings found. Exiting.");
    return true;
  }

  const summary: MigrationSummary = {
    processed: 0,
    skipped: 0,
    failed: 0,
  };

  for (const posting of postings) {
    const dynamoKey = resolveDynamoKey(posting);
    if (!dynamoKey) {
      summary.skipped += 1;
      console.warn("Skipping posting without identifiable key:", posting);
      continue;
    }

    try {
      const normalized = normalizeDynamoJobPosting(posting);
      const { jobId } = await upsertNormalizedJob(normalized);
      await markPostingAsNormalized(dynamoKey);
      summary.processed += 1;
      console.log(`✅ Upserted job ${jobId} for dynamoId ${dynamoKey.value}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`❌ Failed to process posting ${dynamoKey.value}:`, error);
    }
  }

  summarize(summary);

  return summary.failed === 0;
}

export const handler = async (
  event: unknown = {}
): Promise<{ statusCode: number; body: string }> => {
  console.log("Lambda invoked. Beginning job normalization run...");
  const success = await migratePostings();
  return {
    statusCode: success ? 200 : 500,
    body: JSON.stringify({ success }),
  };
};

export default handler;
