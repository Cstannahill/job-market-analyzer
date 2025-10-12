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
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" }); // Set your region

// Environment variables
const S3_BUCKET = process.env.S3_BUCKET || "job-postings-bucket-cstannahill";
const ENRICHMENT_TABLE =
  process.env.ENRICHMENT_TABLE || "job-postings-enhanced";

// Model configuration - Choose one based on your needs
const MODEL_CONFIG = {
  // RECOMMENDED: Best balance of quality and cost
  pro: {
    modelId: "amazon.nova-pro-v1:0",
    maxTokens: 4096,
    batchSize: 3, // Smaller batches for better quality
  },
  // HIGHEST QUALITY: Use for best results
  premier: {
    modelId: "amazon.nova-premier-v1:0",
    maxTokens: 4096,
    batchSize: 2, // Smaller batches due to complexity
  },
  // MOST EFFICIENT: Use for cost savings
  micro: {
    modelId: "amazon.nova-micro-v1:0",
    maxTokens: 4096,
    batchSize: 5,
  },
  // ALTERNATIVE: Llama 3.3 70B (good quality, open source)
  llama: {
    modelId: "meta.llama3-3-70b-instruct-v1:0",
    maxTokens: 4096,
    batchSize: 3,
  },
};

// Select your model here
const SELECTED_MODEL = MODEL_CONFIG.pro; // Change to .premier, .micro, or .llama
const BATCH_SIZE = SELECTED_MODEL.batchSize;
const MAX_FILES_PER_RUN = 50;

interface JobFile {
  fileName: string;
  contents: string;
}

interface EnrichedJobData {
  jobId: string;
  job_title: string;
  job_description: string;
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
  console.log("Starting Bedrock LLM enrichment process...");
  console.log(`Using model: ${SELECTED_MODEL.modelId}`);

  try {
    const unprocessedFiles = await getUnprocessedFiles();

    if (unprocessedFiles.length === 0) {
      console.log("No unprocessed files found");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No files to process" }),
      };
    }

    console.log(`Found ${unprocessedFiles.length} unprocessed files`);
    const filesToProcess = unprocessedFiles.slice(0, MAX_FILES_PER_RUN);
    const results = await processBatches(filesToProcess);

    console.log("Enrichment completed:", results);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Bedrock LLM enrichment completed",
        processed: results.success,
        failed: results.failed,
        skipped: unprocessedFiles.length - filesToProcess.length,
        model: SELECTED_MODEL.modelId,
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

        const jobId = key.replace(".json", "");
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
 * Process files in batches
 */
async function processBatches(
  fileKeys: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < fileKeys.length; i += BATCH_SIZE) {
    const batch = fileKeys.slice(i, i + BATCH_SIZE);

    try {
      const jobFiles = await fetchJobFiles(batch);
      const enrichedData = await enrichWithBedrock(jobFiles);

      for (const data of enrichedData) {
        try {
          await saveEnrichedData(data);
          success++;
        } catch (error) {
          console.error(`Failed to save ${data.jobId}:`, error);
          failed++;
        }
      }

      // Small delay between batches
      await delay(1000);
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
 * Build user prompt for job analysis
 */
function buildUserPrompt(jobFiles: JobFile[]): string {
  const jobsSection = jobFiles
    .map((job, idx) => {
      return `### JOB ${idx + 1}
ID: ${job.fileName}
CONTENT:
${job.contents}
`;
    })
    .join("\n---\n\n");

  return `Analyze these ${jobFiles.length} job postings and extract structured information.

${jobsSection}

Return a JSON array with ${jobFiles.length} objects in the same order, following this exact schema:

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
 * Enrich job postings with Bedrock LLM
 */
async function enrichWithBedrock(
  jobFiles: JobFile[]
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
    - If unclear or multiple: null

12. JOB_TITLE and JOB_DESCRIPTION:
    - JOB_TITLE: Extract the exact job title as stated in the posting - this will be found in the name property.
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

  const userPrompt = buildUserPrompt(jobFiles);

  try {
    // Prepare the request body based on model type
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

    console.log(`Invoking Bedrock model: ${SELECTED_MODEL.modelId}`);
    const response = await bedrockClient.send(command);

    // Parse the response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract content based on response structure
    const content =
      responseBody.output?.message?.content?.[0]?.text ||
      responseBody.content?.[0]?.text;

    if (!content) {
      throw new Error("No content in Bedrock response");
    }

    console.log(
      "Raw Bedrock response (first 200 chars):",
      content.substring(0, 200)
    );

    // Clean response
    const cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedContent);

    // Validate it's an array
    if (!Array.isArray(parsedData)) {
      throw new Error("Bedrock response is not an array");
    }

    // Validate and normalize each entry
    return parsedData.map((data, idx) =>
      validateEnrichedData(data, jobFiles[idx].fileName)
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
 * Validate and normalize enriched data
 */
function validateEnrichedData(data: any, jobId: string): EnrichedJobData {
  const validated: EnrichedJobData = {
    jobId: data.jobId || jobId,
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
  };

  // Deduplicate arrays
  validated.technologies = [...new Set(validated.technologies)];
  validated.skills = [...new Set(validated.skills)];
  validated.requirements = [...new Set(validated.requirements)];
  validated.benefits = [...new Set(validated.benefits)];

  return validated;
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
