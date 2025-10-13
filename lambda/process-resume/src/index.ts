import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export const handler = async (event: any) => {
  try {
    const fileKey = decodeURIComponent(event.pathParameters.id);

    // Get object from S3
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: fileKey,
    });

    const response = await s3.send(command);
    const stream = await sdkStreamMixin(response.Body);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Process your file here
    const analysis = await processFile(buffer, fileKey);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "complete",
        analysis,
      }),
    };
  } catch (error) {
    console.error("Process error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

async function processFile(buffer: Buffer, key: string) {
  // Your processing logic here
  // Examples:
  // - Parse PDF with pdfjs
  // - Parse DOCX with mammoth
  // - Call Bedrock for analysis
  // - Extract and enrich data

  return {
    filename: key.split("/").pop(),
    size: buffer.length,
    processedAt: new Date().toISOString(),
    // ... your analysis data
  };
}
