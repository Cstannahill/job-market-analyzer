import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { countUserResumes, insertResume } from "./dynamoService.js";
const s3 = new S3Client({ region: process.env.AWS_REGION_NAME || "us-east-1" });
const MAX_RESUMES_PER_USER = Number(process.env.MAX_RESUMES_PER_USER ?? 10);
const ALLOWED_USER_BYPASS_ID = process.env.ALLOWED_USER_BYPASS_ID;
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://main.d2qk81z2cubp0y.amplifyapp.com",
];
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
function buildCorsHeaders(origin?: string) {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]; // fallback (localhost)

  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export const handler = async (event: any) => {
  const origin = event.headers.Origin || event.headers.origin;
  const headers = buildCorsHeaders(origin);

  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers, body: "" };
    }

    const body = JSON.parse(event.body || "{}");
    const { filename, contentType, userId } = body;

    if (!filename || !contentType || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing filename or contentType or userId",
        }),
      };
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Unsupported content type" }),
      };
    }
    if (userId !== ALLOWED_USER_BYPASS_ID) {
      const currentCount = await countUserResumes(userId);
      if (currentCount >= MAX_RESUMES_PER_USER) {
        return {
          statusCode: 409, // Conflict (quota reached)
          headers,
          body: JSON.stringify({
            error:
              `You’ve reached the limit of ${MAX_RESUMES_PER_USER} resumes. ` +
              "Please delete one before uploading another.",
          }),
        };
      }
    }
    const resumeId = uuidv4();
    const key = `resumes/${userId}/${resumeId}-${Date.now()}`;
    await insertResume({
      PK: `USER#${userId}`,
      SK: `RESUME#${resumeId}`,
      status: "pending",
      originalFileName: filename,
      s3Key: key,
      contentType: contentType,
      uploadInitiatedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours TTL
    });

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
      Metadata: { originalFileName: filename, userId: userId },
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url, key }),
    };
  } catch (error) {
    console.error("Presigned URL error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to generate presigned URL" }),
    };
  }
};
