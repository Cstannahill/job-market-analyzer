import { processBatches } from "./aiService.js";
import { getUnprocessedJobsFromDynamo } from "./dbService.js";
import { v4 as uuid } from "uuid";

// Environment variables / config
const MAX_ITEMS_PER_RUN = Number(process.env.MAX_ITEMS_PER_RUN || 100);
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "qwen/qwen3-coder:free";

export const handler = async () => {
  try {
    const unprocessedJobs = await getUnprocessedJobsFromDynamo();
    if (unprocessedJobs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No jobs to process" }),
      };
    }

    const jobsToProcess = unprocessedJobs.slice(0, MAX_ITEMS_PER_RUN);
    console.log(unprocessedJobs.length, "UNPROCESSED");
    const run = uuid();
    const res = await processBatches(jobsToProcess, run);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "OpenRouter LLM enrichment completed",
        processed: res.success,
        failed: res.failed,
        skipped: unprocessedJobs.length - jobsToProcess.length,
        model: OPENROUTER_MODEL,
      }),
    };
  } catch (error) {
    console.error("Fatal error in enrichment:", error);
    throw error;
  }
};
