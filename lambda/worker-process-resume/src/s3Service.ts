import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import fs from "fs";
import os from "os";
import path from "path";

const BUCKET = process.env.S3_BUCKET_NAME || "job-market-analyzer-resumes";
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
export async function getS3Object(
  key: string
): Promise<Buffer | { filePath: string }> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const response = await s3.send(command);
    if (!response.Body) throw new Error("No body found");

    const stream = await sdkStreamMixin(response.Body);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (key.toLowerCase().endsWith(".pdf")) {
      const tempPath = path.join(os.tmpdir(), path.basename(key));
      await fs.promises.writeFile(tempPath, buffer);
      return { filePath: tempPath };
    }
    return buffer;
  } catch (err: any) {
    if (err.name === "NoSuchKey") {
      throw new Error("Resume file not found in S3");
    }
    console.error("S3 error:", err);
    throw err;
  }
}
