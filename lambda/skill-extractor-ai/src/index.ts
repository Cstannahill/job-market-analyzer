import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import axios from "axios";

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const S3_BUCKET = process.env.S3_BUCKET || "job-postings-bucket-cstannahill";
const ENRICHMENT_TABLE =
  process.env.ENRICHMENT_TABLE || "job-postings-enhanced";
const OPENROUTER_KEYS = [
  process.env.OPENROUTER_KEY_1,
  process.env.OPENROUTER_KEY_2,
  process.env.OPENROUTER_KEY_3,
  process.env.OPENROUTER_KEY_4,
  process.env.OPENROUTER_KEY_5,
].filter(Boolean) as string[];

const MODEL = "deepseek/deepseek-chat-v3.1:free";
const BATCH_SIZE = 5;
const MAX_FILES_PER_RUN = 50; // Stay within daily limit

let currentKeyIndex = 0;

interface JobFile {
  fileName: string;
  contents: string;
}

interface EnrichedJobData {
  jobId: string; // filename without extension: "muse-18392636"
  technologies: string[];
  skills: string[];
  requirements: string[];
  seniority_level?: string;
  location?: string;
  company_name?: string;
  salary_mentioned: boolean;
  salary_range?: string;
  remote_status?: string;
  benefits?: string[];
  company_size?: string;
  industry?: string;
  processed_date: string;
}

/**
 * Lambda handler - runs on schedule (EventBridge)
 */
export const handler = async () => {
  console.log("Starting LLM enrichment process...");

  try {
    // Get list of unprocessed JSON files from S3
    const unprocessedFiles = await getUnprocessedFiles();

    if (unprocessedFiles.length === 0) {
      console.log("No unprocessed files found");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No files to process" }),
      };
    }

    console.log(`Found ${unprocessedFiles.length} unprocessed files`);

    // Limit to MAX_FILES_PER_RUN to avoid hitting daily limits
    const filesToProcess = unprocessedFiles.slice(0, MAX_FILES_PER_RUN);

    // Process in batches
    const results = await processBatches(filesToProcess);

    console.log("Enrichment completed:", results);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "LLM enrichment completed",
        processed: results.success,
        failed: results.failed,
        skipped: unprocessedFiles.length - filesToProcess.length,
      }),
    };
  } catch (error) {
    console.error("Fatal error in enrichment:", error);
    throw error;
  }
};

/**
 * Get list of files from S3 that haven't been processed yet
 */
async function getUnprocessedFiles(): Promise<string[]> {
  const unprocessed: string[] = [];
  let continuationToken: string | undefined;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(listCommand);

    if (response.Contents) {
      for (const object of response.Contents) {
        const key = object.Key;
        if (!key || !key.endsWith(".json")) continue;

        // Extract jobId from filename (remove .json extension)
        const jobId = key.replace(".json", "");

        // Check if already processed
        const isProcessed = await isJobProcessed(jobId);
        if (!isProcessed) {
          unprocessed.push(key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return unprocessed;
}

/**
 * Check if a job has already been processed
 */
async function isJobProcessed(jobId: string): Promise<boolean> {
  try {
    const command = new GetCommand({
      TableName: ENRICHMENT_TABLE,
      Key: { jobId },
    });

    const response = await docClient.send(command);
    return !!response.Item;
  } catch (error) {
    console.error(`Error checking if ${jobId} is processed:`, error);
    return false;
  }
}

/**
 * Process files in batches of BATCH_SIZE
 */
async function processBatches(
  fileKeys: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < fileKeys.length; i += BATCH_SIZE) {
    const batch = fileKeys.slice(i, i + BATCH_SIZE);

    try {
      // Fetch file contents for batch
      const jobFiles = await fetchJobFiles(batch);

      // Call LLM with batch
      const enrichedData = await enrichWithLLM(jobFiles);

      // Save results to DynamoDB
      for (const data of enrichedData) {
        try {
          await saveEnrichedData(data);
          success++;
        } catch (error) {
          console.error(`Failed to save ${data.jobId}:`, error);
          failed++;
        }
      }

      // Add delay to respect rate limits (20 req/min = 3 seconds between requests)
      await delay(3000);
    } catch (error) {
      console.error(`Batch processing failed:`, error);
      failed += batch.length;
    }
  }

  return { success, failed };
}

/**
 * Fetch job file contents from S3
 */
async function fetchJobFiles(fileKeys: string[]): Promise<JobFile[]> {
  const jobFiles: JobFile[] = [];

  for (const key of fileKeys) {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);
      const bodyString = await streamToString(response.Body);
      const jobData = JSON.parse(bodyString);

      jobFiles.push({
        fileName: key.replace(".json", ""),
        contents: jobData.contents || jobData.description || "",
      });
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error);
    }
  }

  return jobFiles;
}

/**
 * Convert stream to string
 */
async function streamToString(stream: any): Promise<string> {
  const chunks: any[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

/**
 * Enrich job postings with LLM analysis
 */
async function enrichWithLLM(jobFiles: JobFile[]): Promise<EnrichedJobData[]> {
  const apiKey = getNextApiKey();

  // Build prompt with all jobs in batch
  const jobsPrompt = jobFiles
    .map((job, idx) => {
      return `JOB ${idx + 1} (ID: ${job.fileName}):
${job.contents}

---`;
    })
    .join("\n");

  const systemPrompt = `You are a job posting analyzer. Extract structured information from job postings.
Return ONLY valid JSON array with no markdown, explanations, or code blocks.

For each job, extract:
- technologies: array of specific tech/tools mentioned (lowercase, normalized - e.g. "python", "javascript", "aws", "docker")
- skills: array of skill requirements extracted as SHORT, NORMALIZED terms (e.g. "python" not "5+ years Python experience", "leadership" not "strong leadership abilities")
- requirements: array of key requirements (education, years of experience, etc.)
- seniority_level: "Entry", "Mid", "Senior", or "Lead" (infer from context)
- salary_mentioned: boolean
- salary_range: string if mentioned, null otherwise
- location: string (city, state/country from job posting - e.g. "San Francisco, CA" or "Remote" or "London, UK")
- remote_status: "Remote", "Hybrid", "On-site", or "Not specified"
- benefits: array of benefits mentioned
- company_name: string (infer from job posting)
- company_size: "Startup", "Small", "Medium", "Large", "Enterprise" or null (infer if possible)
- industry: string or null (infer from job context)`;

  const userPrompt = `Extract information from these ${jobFiles.length} job postings. Return a JSON array with one object per job, in the same order.

${jobsPrompt}

Return format:
[
  {
    "jobId": "muse-123456",
    "technologies": ["python", "aws", "docker"],
    "skills": ["5+ years Python experience", "AWS cloud architecture"],
    "requirements": ["Bachelor's in CS", "5+ years experience"],
    "seniority_level": "Senior",
    "salary_mentioned": false,
    "salary_range": null,
    "remote_status": "Hybrid",
    "benefits": ["health insurance", "401k"],
    "company_size": "Medium",
    "industry": "fintech"
  }
]`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent extraction
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000, // 60 second timeout
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in LLM response");
    }

    // Parse response, removing any markdown formatting
    const cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedContent) as EnrichedJobData[];

    // Add processed_date to each record
    const processedDate = new Date().toISOString();
    return parsedData.map((data) => ({
      ...data,
      processed_date: processedDate,
    }));
  } catch (error) {
    console.error("LLM API error:", error);
    throw error;
  }
}

/**
 * Rotate through API keys
 */
function getNextApiKey(): string {
  if (OPENROUTER_KEYS.length === 0) {
    throw new Error("No OpenRouter API keys configured");
  }

  const key = OPENROUTER_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % OPENROUTER_KEYS.length;
  return key;
}

/**
 * Save enriched data to DynamoDB
 */
async function saveEnrichedData(data: EnrichedJobData): Promise<void> {
  const command = new PutCommand({
    TableName: ENRICHMENT_TABLE,
    Item: data,
  });

  await docClient.send(command);
  console.log(`Saved enriched data for: ${data.jobId}`);
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
