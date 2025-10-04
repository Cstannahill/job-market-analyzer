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
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      console.log(`Processing file: ${key} from bucket: ${bucket}`);

      // Step 1: Get the file from S3
      const jobPostingText = await getFileFromS3(bucket, key);

      // Step 2: Extract skills using AWS Comprehend
      const extractedData = await extractSkillsFromText(jobPostingText);

      // Step 3: Save to DynamoDB
      await saveToDatabase(key, jobPostingText, extractedData);

      console.log(`Successfully processed: ${key}`);
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

  return bodyContents;
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

  const jobPosting: JobPosting = {
    posting_id: randomUUID(),
    title,
    skills: extractedData.skills,
    technologies: extractedData.technologies,
    raw_text: rawText.slice(0, 1000), // Store first 1000 chars only
    date: new Date().toISOString(),
    source_file: sourceFile,
  };

  const command = new PutCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME || "JobPostings",
    Item: jobPosting,
  });

  await docClient.send(command);
  console.log(`Saved to DynamoDB: ${jobPosting.posting_id}`);
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
