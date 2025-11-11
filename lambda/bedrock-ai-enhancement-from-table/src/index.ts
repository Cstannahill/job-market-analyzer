import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  type ScanCommandOutput,
  type NativeAttributeValue,
} from "@aws-sdk/lib-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

//
// AWS clients
//
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

//
// Environment variables / config
//
const SOURCE_TABLE = process.env.SOURCE_TABLE || "job-postings"; // raw ingest table
const ENRICHMENT_TABLE =
  process.env.ENRICHMENT_TABLE || "job-postings-enhanced";

const MODEL_CONFIG = {
  pro: {
    modelId: "amazon.nova-pro-v1:0",
    maxTokens: 4096,
    batchSize: 3,
  },
  premier: {
    modelId: "amazon.nova-premier-v1:0",
    maxTokens: 4096,
    batchSize: 2,
  },
  micro: {
    modelId: "amazon.nova-micro-v1:0",
    maxTokens: 4096,
    batchSize: 5,
  },
  llama: {
    modelId: "meta.llama3-3-70b-instruct-v1:0",
    maxTokens: 4096,
    batchSize: 3,
  },
};

// pick your poison
const SELECTED_MODEL = MODEL_CONFIG.pro;
const BATCH_SIZE = SELECTED_MODEL.batchSize;

// hard safety caps
const MAX_ITEMS_PER_RUN = 50; // similar to MAX_FILES_PER_RUN in S3 version
const MAX_SCAN_PAGES = 20; // safety so we don't burn the whole table on 1 run

//
// Types
//
interface JobRecord {
  jobId: string; // derived from PK (strip "JOB#")
  company?: string;
  title?: string;
  description?: string; // escaped HTML blob from source
  postedDate?: string;
  locationRaw?: string; // JSON string field from table
  sourcesRaw?: string; // JSON string of sources, may include URLs
}

interface EnrichedJobData {
  jobId: string;
  job_title: string | undefined;
  job_description: string | undefined;
  technologies: string[];
  skills: string[];
  requirements: string[];
  seniority_level?: string;
  location?: string;
  company_name?: string;
  salary_mentioned: boolean;
  salary_range?: string;
  remote_status: string | undefined;
  benefits: string[];
  company_size?: string;
  industry?: string;
  processed_date: string;
  status?: string; // we'll set "processed"
}

/**
 * Lambda handler - runs on schedule (EventBridge)
 */
export const handler = async () => {
  try {
    // 1. Find unprocessed jobs in DynamoDB
    const unprocessedJobs = await getUnprocessedJobsFromDynamo();

    if (unprocessedJobs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No jobs to process" }),
      };
    }

    // 2. Cap work per run
    const jobsToProcess = unprocessedJobs.slice(0, MAX_ITEMS_PER_RUN);

    // 3. Process in batches
    const results = await processBatches(jobsToProcess);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Bedrock LLM enrichment completed",
        processed: results.success,
        failed: results.failed,
        skipped: unprocessedJobs.length - jobsToProcess.length,
        model: SELECTED_MODEL.modelId,
      }),
    };
  } catch (error) {
    console.error("Fatal error in enrichment:", error);
    throw error;
  }
};

/**
 * Scan the SOURCE_TABLE and return JobRecord[] for rows that are NOT yet in ENRICHMENT_TABLE
 *
 * NOTE:
 * - We assume each row in SOURCE_TABLE has PK like "JOB#<hash>" and SK like "POSTING#v1"
 * - jobId for enrichment will just be <hash>, not including "JOB#"
 */
async function getUnprocessedJobsFromDynamo(): Promise<JobRecord[]> {
  const results: JobRecord[] = [];
  let lastEvaluatedKey: Record<string, NativeAttributeValue> | undefined;
  let pageCount = 0;

  do {
    pageCount++;
    if (pageCount > MAX_SCAN_PAGES) break;

    // 🔒 Properly typed response
    const scanResp: ScanCommandOutput = await docClient.send(
      new ScanCommand({
        TableName: SOURCE_TABLE,
        Limit: 200,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = scanResp.Items ?? [];

    for (const item of items) {
      if (!item.PK || typeof item.PK !== "string") continue;

      const jobId = item.PK.replace(/^JOB#/, "");
      const alreadyProcessed = await isJobProcessed(jobId);
      if (alreadyProcessed) continue;

      results.push({
        jobId,
        company: safeString(item.company),
        title: safeString(item.title),
        description: safeString(item.description),
        postedDate: safeString(item.postedDate),
        locationRaw: safeString(item.location),
        sourcesRaw: safeString(item.sources),
      });

      if (results.length >= MAX_ITEMS_PER_RUN) break;
    }

    lastEvaluatedKey = scanResp.LastEvaluatedKey;
    if (results.length >= MAX_ITEMS_PER_RUN) break;
  } while (lastEvaluatedKey);

  return results;
}

/**
 * Helper: type guard / normalizer for stringy fields
 */
function safeString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Check if a job has already been processed (exists in ENRICHMENT_TABLE)
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
 * Process records in batches through Bedrock
 */
async function processBatches(
  jobRecords: JobRecord[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < jobRecords.length; i += BATCH_SIZE) {
    const batch = jobRecords.slice(i, i + BATCH_SIZE);

    try {
      const enrichedData = await enrichWithBedrock(batch);

      for (const data of enrichedData) {
        try {
          await saveEnrichedData(data);
          success++;
        } catch (error) {
          console.error(`Failed to save ${data.jobId}:`, error);
          failed++;
        }
      }

      // polite pause to avoid hammering Bedrock / DynamoDB
      await delay(1000);
    } catch (error) {
      console.error("Batch processing failed:", error);
      failed += batch.length;
    }
  }

  return { success, failed };
}

/**
 * Build the per-batch user prompt from DynamoDB rows instead of S3 files
 *
 * We inject structured context we already have (company, title, location, etc.)
 * and the raw description text/HTML.
 */
function buildUserPrompt(jobRecords: JobRecord[]): string {
  const jobsSection = jobRecords
    .map((job, idx) => {
      return `### JOB ${idx + 1}
ID: ${job.jobId}
COMPANY: ${job.company ?? "N/A"}
TITLE: ${job.title ?? "N/A"}
POSTED: ${job.postedDate ?? "N/A"}
LOCATION_RAW: ${job.locationRaw ?? "N/A"}
SOURCES_RAW: ${job.sourcesRaw ?? "N/A"}

DESCRIPTION:
${job.description ?? ""}
`;
    })
    .join("\n---\n\n");

  return `Analyze these ${jobRecords.length} job postings and extract structured information.

${jobsSection}

Return a JSON array with ${jobRecords.length} objects in the same order, following this exact schema:

[
  {
    "jobId": "string (use the ID provided above)",
    "job_title": "string",
    "job_description": "string",
    "technologies": ["array", "of", "strings"],
    "skills": ["array", "of", "strings"],
    "requirements": ["array", "of", "strings"],
    "seniority_level": "Entry|Mid|Senior|Lead|Executive",
    "location": "string or null",
    "company_name": "string or null",
    "salary_mentioned": true|false,
    "salary_range": "string or null",
    "remote_status": "Remote|Hybrid|On-site|Not specified",
    "benefits": ["array", "of", "strings"],
    "company_size": "Startup|Small|Medium|Large|Enterprise or null",
    "industry": "string or null"
  }
]`;
}

/**
 * Call Bedrock with a batch of JobRecord[]
 * and get back structured EnrichedJobData[]
 */
async function enrichWithBedrock(
  jobRecords: JobRecord[]
): Promise<EnrichedJobData[]> {
  const systemPrompt = `You are a job posting analyzer that extracts structured data from job descriptions.

CRITICAL: Return ONLY a valid JSON array. No markdown code blocks, no explanations, no preamble.

EXTRACTION RULES:

1. TECHNOLOGIES (technical tools/platforms):
   - Extract specific tools, languages, frameworks, platforms
   - Normalize to lowercase, standard names
   - Examples: "python", "react", "aws", "kubernetes", "postgresql"
   - If a version is mentioned, include it: "python3", "react18"
   - Separate multiple related items: ["aws", "s3", "lambda"] not ["aws s3 lambda"]

2. SKILLS (professional abilities):
   - Extract as SHORT normalized phrases (2-4 words max)
   - Focus on the skill itself, not experience level
   - Examples: "api design", "team leadership", "agile methodology"
   - NOT: "5+ years of API design experience" → USE: "api design"
   - Deduplicate similar skills

3. REQUIREMENTS (qualifications):
   - Extract specific, measurable requirements
   - Include: education, years of experience, certifications, clearances
   - Format consistently: "Bachelor's degree in Computer Science", "5+ years experience", "Security clearance required"
   - Keep it factual, no marketing language

4. SENIORITY_LEVEL:
   - Must be exactly one of: "Entry", "Mid", "Senior", "Lead", "Executive"
   - Infer from: job title, years of experience required, responsibilities
   - Default to "Mid" if ambiguous

5. LOCATION:
   - Extract exact location mentioned in posting
   - Format: "City, State" (US) or "City, Country" (International)
   - If multiple locations: use primary or "Multiple locations"
   - If fully remote: "Remote"
   - If not specified: "Not specified"

6. REMOTE_STATUS:
   - Must be exactly one of: "Remote", "Hybrid", "On-site", "Not specified"
   - Remote: work from anywhere
   - Hybrid: mix of remote and office
   - On-site: must be in office

7. SALARY:
   - salary_mentioned: true if ANY salary info present (even "competitive")
   - salary_range: extract exact figures if given, format as "$XXk-$YYk" or "$XXk+"
   - If only "competitive" mentioned: salary_mentioned=true, salary_range=null

8. BENEFITS:
   - Extract specific benefits mentioned
   - Normalize: "health insurance", "dental insurance", "401k", "unlimited pto", "equity"
   - Exclude vague terms like "competitive benefits"
   - If none mentioned: empty array []

9. COMPANY_NAME:
   - Extract exact company name from posting
   - If not explicitly stated: null (do not guess)

10. COMPANY_SIZE:
    - Must be exactly one of: "Startup", "Small", "Medium", "Large", "Enterprise", null
    - Only infer if there are clear indicators (employee count, "Fortune 500", "seed-stage startup")
    - When in doubt: null

11. INDUSTRY:
    - Single broad category: "technology", "healthcare", "finance", "education", etc.
    - Use lowercase
    - If unclear or multiple: use most prominent

12. JOB_TITLE and JOB_DESCRIPTION:
    - JOB_TITLE: Extract the exact job title as stated in the posting.
    - JOB_DESCRIPTION: Provide a concise summary (1-2 sentences) capturing the essence of the job role and responsibilities.

VALIDATION RULES:
- All array fields must be arrays (even if empty: [])
- No null values in arrays
- No duplicate entries in arrays
- All strings must be trimmed of whitespace
- Boolean fields must be true/false, never null
- Empty/missing data should be null for optional fields, never omit the field

RESPONSE FORMAT:
Return a JSON array with one object per job, maintaining the same order as input.`;

  const userPrompt = buildUserPrompt(jobRecords);

  try {
    const requestBody = {
      messages: [
        {
          role: "user",
          content: [
            {
              text: `${systemPrompt}\n\n${userPrompt}`,
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: SELECTED_MODEL.maxTokens,
        temperature: 0.1,
        topP: 0.95,
      },
    };

    const command = new InvokeModelCommand({
      modelId: SELECTED_MODEL.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(requestBody),
    });

    const response = await bedrockClient.send(command);

    // Bedrock's body is a Uint8Array
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const content =
      responseBody.output?.message?.content?.[0]?.text ||
      responseBody.content?.[0]?.text;

    if (!content) {
      throw new Error("No content in Bedrock response");
    }

    const cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedContent);

    if (!Array.isArray(parsedData)) {
      throw new Error("Bedrock response is not an array");
    }

    // map and validate each object to EnrichedJobData
    return parsedData.map((data: any, idx: number) =>
      validateEnrichedData(data, jobRecords[idx].jobId)
    );
  } catch (error) {
    console.error("Bedrock API error:", error);
    if (error instanceof SyntaxError) {
      console.error("Failed to parse Bedrock response");
    }
    throw error;
  }
}

/**
 * Validate + normalize enriched data into our DynamoDB enhanced format.
 * Same logic you already had, with one addition: we set status="processed".
 */
function validateEnrichedData(
  data: any,
  fallbackJobId: string
): EnrichedJobData {
  const validated: EnrichedJobData = {
    jobId: typeof data.jobId === "string" ? data.jobId : fallbackJobId,
    job_title:
      typeof data.job_title === "string" ? data.job_title.trim() : undefined,
    job_description:
      typeof data.job_description === "string"
        ? data.job_description.trim()
        : undefined,
    technologies: Array.isArray(data.technologies)
      ? data.technologies.filter((t: any) => typeof t === "string" && t.trim())
      : [],
    skills: Array.isArray(data.skills)
      ? data.skills.filter((s: any) => typeof s === "string" && s.trim())
      : [],
    requirements: Array.isArray(data.requirements)
      ? data.requirements.filter((r: any) => typeof r === "string" && r.trim())
      : [],
    seniority_level: ["Entry", "Mid", "Senior", "Lead", "Executive"].includes(
      data.seniority_level
    )
      ? data.seniority_level
      : "Mid",
    location:
      typeof data.location === "string" ? data.location.trim() : undefined,
    company_name:
      typeof data.company_name === "string"
        ? data.company_name.trim()
        : undefined,
    salary_mentioned: Boolean(data.salary_mentioned),
    salary_range:
      typeof data.salary_range === "string"
        ? data.salary_range.trim()
        : undefined,
    remote_status: ["Remote", "Hybrid", "On-site", "Not specified"].includes(
      data.remote_status
    )
      ? data.remote_status
      : "Not specified",
    benefits: Array.isArray(data.benefits)
      ? data.benefits.filter((b: any) => typeof b === "string" && b.trim())
      : [],
    company_size: [
      "Startup",
      "Small",
      "Medium",
      "Large",
      "Enterprise",
    ].includes(data.company_size)
      ? data.company_size
      : undefined,
    industry:
      typeof data.industry === "string" ? data.industry.trim() : undefined,
    processed_date: new Date().toISOString(),
    status: "processed",
  };

  // Deduplicate arrays
  validated.technologies = [...new Set(validated.technologies)];
  validated.skills = [...new Set(validated.skills)];
  validated.requirements = [...new Set(validated.requirements)];
  validated.benefits = [...new Set(validated.benefits)];

  return validated;
}

/**
 * Save enriched record into the ENRICHMENT_TABLE
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
 * Sleep helper to pace batches
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
