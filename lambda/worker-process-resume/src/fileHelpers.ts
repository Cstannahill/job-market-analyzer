import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

export function isPdf(ext: string, contentType?: string) {
  return (
    ext === "pdf" ||
    contentType === "application/pdf" ||
    contentType === "application/x-pdf"
  );
}

export function isDocx(ext: string, contentType?: string) {
  return (
    ext === "docx" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export const streamToBuffer = async (stream: Readable): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
    );
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

export async function normalizeS3PayloadToBuffer(
  s3Object: unknown
): Promise<Buffer> {
  if (
    s3Object &&
    typeof s3Object === "object" &&
    "filePath" in (s3Object as any) &&
    typeof (s3Object as any).filePath === "string"
  ) {
    return fs.readFileSync((s3Object as any).filePath as string);
  }

  if (Buffer.isBuffer(s3Object)) return s3Object as Buffer;
  if (s3Object instanceof Uint8Array) return Buffer.from(s3Object);

  if (s3Object && typeof s3Object === "object" && "Body" in (s3Object as any)) {
    const body = (s3Object as any).Body;
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof Uint8Array) return Buffer.from(body);
    if (typeof body?.pipe === "function")
      return await streamToBuffer(body as Readable);
  }

  throw new Error("Unsupported S3 object shape");
}
