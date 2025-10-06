import { S3Event, Context } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

// Initialize AWS clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Define types
interface ExtractedSkills {
  skills: string[];
  technologies: string[];
  keyPhrases: string[];
}

interface JobPosting {
  posting_id: string;
  title: string;
  skills: string[];
  technologies: string[];
  raw_text: string;
  date: string;
  source_file: string;
}

/**
 * Lambda handler - triggered when a file is uploaded to S3
 */
export const handler = async (event: S3Event, context: Context) => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  try {
    // Process each uploaded file (usually just one)
    if (event?.Records && Array.isArray(event.Records)) {
      for (const record of event?.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(
          record.s3.object.key.replace(/\+/g, " ")
        );

        console.log(`Processing file: ${key} from bucket: ${bucket}`);

        // Step 1: Get the file from S3
        const jobPostingText = await getFileFromS3(bucket, key);

        // Step 2: Extract skills using AWS Comprehend
        const extractedData = await extractSkillsFromText(jobPostingText);

        // Step 3: Save to DynamoDB
        await saveToDatabase(key, jobPostingText, extractedData);

        console.log(`Successfully processed: ${key}`);
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Job posting processed successfully" }),
    };
  } catch (error) {
    console.error("Error processing job posting:", error);
    throw error;
  }
};

/**
 * Fetch file content from S3
 */
async function getFileFromS3(bucket: string, key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  const bodyContents = await streamToString(response.Body);

  // Try to parse JSON and extract the job text (contents/content/description)
  const stripHtml = (s: any) =>
    String(s || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

  let text = bodyContents;
  try {
    const parsed = JSON.parse(bodyContents);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed)) {
        // If an array of job objects, join their contents
        const parts = parsed
          .map((p) =>
            p && (p.contents || p.content || p.description)
              ? p.contents || p.content || p.description
              : null
          )
          .filter(Boolean)
          .map((p) => stripHtml(p));
        if (parts.length) text = parts.join("\n\n");
        else text = stripHtml(bodyContents);
      } else {
        const candidate =
          parsed.contents || parsed.content || parsed.description || null;
        if (candidate) text = stripHtml(candidate);
        else text = stripHtml(JSON.stringify(parsed));
      }
    }
  } catch (e) {
    // not JSON, keep original bodyContents
    text = stripHtml(bodyContents);
  }

  return text;
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
 * Extract skills using pattern matching (no external API needed)
 * This is a simplified version that works without AWS Comprehend
 */
async function extractSkillsFromText(text: string): Promise<ExtractedSkills> {
  const skills: Set<string> = new Set();
  const technologies: Set<string> = new Set();
  const keyPhrases: Set<string> = new Set();

  // Common technology keywords to look for
  const techPatterns = [
    "aws",
    "lambda",
    "dynamodb",
    "s3",
    "ec2",
    "rds",
    "cloudfront",
    "api gateway",
    "react",
    "typescript",
    "javascript",
    "python",
    "java",
    "node.js",
    "nodejs",
    "docker",
    "kubernetes",
    "terraform",
    "cloudformation",
    "graphql",
    "rest api",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "kafka",
    "rabbitmq",
    "jenkins",
    "github actions",
    "ci/cd",
    "git",
    "microservices",
    "angular",
    "vue",
    "next.js",
    "express",
    "fastapi",
    "django",
    "flask",
    "css",
    "html",
    "sass",
    "tailwind",
    "bootstrap",
    "webpack",
    "vite",
  ];

  // Skill-related phrases
  const skillPatterns = [
    "experience with",
    "knowledge of",
    "proficiency in",
    "expertise in",
    "familiarity with",
    "understanding of",
    "ability to",
    "strong in",
    "background in",
    "skilled in",
    "competent in",
  ];

  const lowerText = text.toLowerCase();

  // Extract technologies
  for (const tech of techPatterns) {
    // Use word boundaries to match whole words
    const escapedTech = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedTech}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) {
      technologies.add(tech);
    }
  }

  // Extract skill phrases (lines containing skill keywords)
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 10) continue;

    const lowerLine = trimmedLine.toLowerCase();

    // Check if line contains skill-related keywords
    for (const pattern of skillPatterns) {
      if (lowerLine.includes(pattern)) {
        keyPhrases.add(trimmedLine.slice(0, 100)); // Limit phrase length

        // Try to extract the actual skill mentioned
        const afterPattern = trimmedLine
          .substring(lowerLine.indexOf(pattern) + pattern.length)
          .trim();

        if (afterPattern.length > 3 && afterPattern.length < 50) {
          skills.add(afterPattern.split(/[,;.]|\band\b/)[0].trim());
        }
        break;
      }
    }

    // Also capture bullet points that look like requirements
    if (trimmedLine.match(/^[-*•]\s+/)) {
      const cleaned = trimmedLine.replace(/^[-*•]\s+/, "").trim();
      if (cleaned.length > 10 && cleaned.length < 100) {
        keyPhrases.add(cleaned);
      }
    }
  }

  // Extract years of experience mentions
  const experienceMatches = text.match(
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi
  );
  if (experienceMatches) {
    experienceMatches.forEach((match) => keyPhrases.add(match));
  }

  return {
    skills: Array.from(skills).slice(0, 20),
    technologies: Array.from(technologies).slice(0, 15),
    keyPhrases: Array.from(keyPhrases).slice(0, 30),
  };
}

async function saveToDatabase(
  sourceFile: string,
  rawText: string,
  extractedData: ExtractedSkills
): Promise<void> {
  // Extract a title from the filename or first line
  const title = extractTitle(sourceFile, rawText);

  // Try to derive a canonical posting id from the filename: <source>-<id>.json
  const filename =
    (sourceFile || "").split("/").pop()?.split("\\").pop() || sourceFile;
  const match = filename.match(/^(.+?)-(.+?)\.json$/i);
  const canonicalId = match ? `${match[1]}-${match[2]}` : null;

  // Try to parse the raw text to find an embedded id (fallback)
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    parsed = null;
  }

  const embeddedId =
    parsed?.id || parsed?.job_id || parsed?.jobId || parsed?.uuid || null;

  // Prefer canonicalId derived from filename. If missing, try to infer a source prefix
  // and use embeddedId to form a <source>-<id> posting id. Do NOT silently fall back
  // to a random UUID because that can create undetectable duplicates.
  let postingId: string | null = null;
  if (canonicalId) {
    postingId = canonicalId;
  } else {
    // try to infer a source prefix from parsed JSON or filename fragments
    const sourceFromParsed =
      parsed?.source || parsed?.source_name || parsed?.sourceKey || null;
    let filenamePrefix: string | null = null;
    const hyphenIndex = filename.indexOf("-");
    if (hyphenIndex > 0) filenamePrefix = filename.slice(0, hyphenIndex);

    const sourcePrefix = sourceFromParsed || filenamePrefix || null;

    if (embeddedId && sourcePrefix) {
      postingId = `${sourcePrefix}-${String(embeddedId)}`;
      console.warn(
        `Inferred posting_id=${postingId} from embedded id and prefix; consider standardizing S3 filenames to <source>-<id>.json`
      );
    } else {
      // Can't form a safe canonical posting id — fail fast so the issue can be investigated
      throw new Error(
        `Unable to derive canonical posting_id for S3 file '${sourceFile}'. ` +
          `Filename='${filename}', embeddedId='${String(embeddedId)}'. ` +
          `Refusing to write random posting_id to avoid undetectable duplicates.`
      );
    }
  }

  // Build the DynamoDB item. If we couldn't form a canonical <source>-<id>, include jobId for linking.
  const jobPosting: any = {
    Id: postingId,
    title,
    skills: extractedData.skills,
    technologies: extractedData.technologies,
    raw_text: rawText.slice(0, 1000), // Store first 1000 chars only
    date: new Date().toISOString(),
    source_file: sourceFile,
  };

  if (!canonicalId && embeddedId) {
    // store the parsed job id so we can link later
    jobPosting.jobId = String(embeddedId);
  }

  const tableName = process.env.DYNAMODB_TABLE_NAME || "JobPostings";

  // If we have a canonical posting id derived from the S3 filename, make the Put conditional
  // so we remain idempotent and avoid duplicating processing.
  try {
    if (canonicalId) {
      const command = new PutCommand({
        TableName: tableName,
        Item: jobPosting,
        ConditionExpression: "attribute_not_exists(posting_id)",
      });
      await docClient.send(command);
      console.log(`Saved to DynamoDB (canonical): ${jobPosting.posting_id}`);
    } else {
      const command = new PutCommand({
        TableName: tableName,
        Item: jobPosting,
      });
      await docClient.send(command);
      console.log(`Saved to DynamoDB: ${jobPosting.posting_id}`);
    }
  } catch (err: any) {
    // If conditional check failed, it's a duplicate; log and continue
    if (
      err?.name === "ConditionalCheckFailedException" ||
      err?.name === "ConditionalCheckFailed"
    ) {
      console.log(
        `Skipping save; item already exists for posting_id=${postingId}`
      );
      return;
    }
    console.error("Error saving to DynamoDB:", err);
    throw err;
  }
}

/**
 * Extract a title from the source file or text content
 */
function extractTitle(filename: string, text: string): string {
  // Try to get title from filename
  const filenameTitle = filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[_-]/g, " ") // Replace underscores/hyphens with spaces
    .replace(/\d+/g, "") // Remove numbers
    .trim();

  if (filenameTitle.length > 5) {
    return filenameTitle;
  }

  // Otherwise, take first non-empty line from text
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return lines[0]?.slice(0, 100) || "Untitled Job Posting";
}
