import { S3Event, Context } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  ComprehendClient,
  DetectEntitiesCommand,
  DetectKeyPhrasesCommand,
} from "@aws-sdk/client-comprehend";
import { randomUUID } from "crypto";

// Initialize AWS clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const comprehendClient = new ComprehendClient({});

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
 * Use AWS Comprehend to extract skills and key phrases
 */
async function extractSkillsFromText(text: string): Promise<ExtractedSkills> {
  // Limit text to 5000 bytes for Comprehend (API limit)
  const truncatedText = text.slice(0, 5000);

  // Extract entities (organizations, titles, etc.)
  const entitiesCommand = new DetectEntitiesCommand({
    Text: truncatedText,
    LanguageCode: "en",
  });

  // Extract key phrases
  const keyPhrasesCommand = new DetectKeyPhrasesCommand({
    Text: truncatedText,
    LanguageCode: "en",
  });

  const [entitiesResponse, keyPhrasesResponse] = await Promise.all([
    comprehendClient.send(entitiesCommand),
    comprehendClient.send(keyPhrasesCommand),
  ]);

  // Filter and categorize extracted data
  const skills: string[] = [];
  const technologies: string[] = [];

  // Extract entities that look like skills/technologies
  if (entitiesResponse.Entities) {
    for (const entity of entitiesResponse.Entities) {
      if (entity.Text && entity.Score && entity.Score > 0.7) {
        // Simple heuristic: if it's uppercase or commonly known tech, it's a technology
        if (isTechnology(entity.Text)) {
          technologies.push(entity.Text);
        }
      }
    }
  }

  // Extract key phrases that might be skills
  const keyPhrases: string[] = [];
  if (keyPhrasesResponse.KeyPhrases) {
    for (const phrase of keyPhrasesResponse.KeyPhrases) {
      if (phrase.Text && phrase.Score && phrase.Score > 0.8) {
        const text = phrase.Text.toLowerCase();

        // Check if phrase contains skill-related keywords
        if (isSkillPhrase(text)) {
          skills.push(phrase.Text);
        }

        keyPhrases.push(phrase.Text);
      }
    }
  }

  // Remove duplicates and clean up
  return {
    skills: [...new Set(skills)].slice(0, 20), // Top 20 skills
    technologies: [...new Set(technologies)].slice(0, 15), // Top 15 technologies
    keyPhrases: keyPhrases.slice(0, 30), // Top 30 phrases
  };
}

/**
 * Check if a term is a technology
 */
function isTechnology(term: string): boolean {
  const technologies = [
    "aws",
    "lambda",
    "dynamodb",
    "s3",
    "react",
    "typescript",
    "javascript",
    "python",
    "java",
    "docker",
    "kubernetes",
    "terraform",
    "graphql",
    "nodejs",
    "node.js",
    "postgresql",
    "mongodb",
    "redis",
    "kafka",
    "jenkins",
    "git",
    "ci/cd",
    "restful",
    "api",
    "microservices",
  ];

  const lowerTerm = term.toLowerCase();
  return technologies.some((tech) => lowerTerm.includes(tech));
}

/**
 * Check if a phrase is skill-related
 */
function isSkillPhrase(phrase: string): boolean {
  const skillKeywords = [
    "experience",
    "knowledge",
    "proficiency",
    "ability",
    "understanding",
    "development",
    "design",
    "architecture",
    "implementation",
    "testing",
    "deployment",
    "management",
    "optimization",
    "debugging",
    "programming",
  ];

  return skillKeywords.some((keyword) => phrase.includes(keyword));
}

/**
 * Save extracted data to DynamoDB
 */
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
