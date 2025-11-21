import type { CompareResult } from "@job-market-analyzer/types";
import axios from "axios";
import type { GetUserResumesResponse } from "@job-market-analyzer/types/resume-query";

const API_URL =
  (import.meta.env.VITE_RESUME_API_URL as string | undefined) || "";

const JQ_API_URL = import.meta.env.VITE_RESUME_JOB_QUEUE_API_URL!;
const API_KEY = (import.meta.env.VITE_API_KEY as string | undefined) || "";

export type UploadStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "complete"
  | "failed";
type JobStatus =
  | "queued"
  | "pending"
  | "processing"
  | "running"
  | "succeeded"
  | "failed";

type JobEnvelope = {
  jobId: string;
  status: JobStatus;
  error?: string;

  result?: CompareResult;

  resumePointer?: { PK: string; SK: string };
};

function mapJobToCompareResult(job: JobEnvelope): CompareResult | null {
  if (job.status === "succeeded" && job.result) {
    return { ...job.result, status: "complete" as const };
  }
  if (job.status === "failed") {
    return {
      status: "failed",
      error: job.error ?? "Processing failed",
    } as Record<string, string>;
  }

  return { status: "processing" } as Record<string, string>;
}

export async function uploadResume(opts: {
  file: File;
  userId: string;
  setStatus: React.Dispatch<React.SetStateAction<UploadStatus>>;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setResult: React.Dispatch<React.SetStateAction<CompareResult | null>>;
  apiBase?: string;
  apiKey?: string;
  jobQApiBase?: string;
}): Promise<void> {
  const {
    file,
    userId,
    setStatus,
    setProgress,
    setError,
    setResult,
    apiBase = API_URL,
    jobQApiBase = JQ_API_URL,
    apiKey = API_KEY,
  } = opts;

  if (!userId || !file) return;

  setStatus("uploading");
  setError(null);
  setProgress(0);

  try {
    const presignedRes = await fetch(`${apiBase}/resumes/upload`, {
      method: "POST",
      headers: {
        ...(apiKey ? { "x-api-key": apiKey } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        userId,
      }),
    });
    if (!presignedRes.ok) {
      const text = await presignedRes.text().catch(() => "");
      throw new Error(`Failed to get presigned URL${text ? ": " + text : ""}`);
    }
    const { url, key } = (await presignedRes.json()) as {
      url: string;
      key: string;
    };
    console.log(url, key, userId);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload to S3 failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () =>
        reject(new Error("Network error while uploading to S3"));
      xhr.onabort = () => reject(new Error("Upload aborted"));

      xhr.send(file);
    });

    setStatus("processing");
    console.log(userId, "FROM RESUME SERVICE");
    const enqueueRes = await fetch(`${jobQApiBase}/jobs`, {
      method: "POST",
      headers: {
        ...(apiKey ? { "x-api-key": apiKey } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        s3Key: key,
      }),
    });
    if (!enqueueRes.ok) {
      const text = await enqueueRes.text().catch(() => "");
      throw new Error(`Failed to enqueue job${text ? ": " + text : ""}`);
    }
    const { jobId } = (await enqueueRes.json()) as { jobId: string };

    let attempt = 0;
    const maxAttempts = 120;
    let delayMs = 2000;

    const nextDelay = (n: number) => Math.min(8000, 1500 + n * 250);

    const poll = async (): Promise<void> => {
      attempt++;
      try {
        const res = await fetch(
          `${jobQApiBase}/jobs/${encodeURIComponent(jobId)}`,
          {
            headers: apiKey ? { "x-api-key": apiKey } : undefined,
          }
        );

        if (!res.ok && res.status !== 404) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Job status error (${res.status})${text ? ": " + text : ""}`
          );
        }

        if (res.ok) {
          const job = (await res.json()) as JobEnvelope;

          if (job.status === "succeeded" && !job.result && job.resumePointer) {
            // Unused
          }

          const legacy = mapJobToCompareResult(job);
          if (legacy) {
            if (legacy.status === "complete") {
              setResult(legacy);
              setStatus("complete");
              setProgress(100);
              return;
            }
            if (legacy.status === "failed") {
              setStatus("failed");
              setError(
                (legacy as Record<string, string>).error ?? "Processing failed"
              );
              return;
            }

            setStatus("processing");
          }
        }

        if (attempt >= maxAttempts) {
          setStatus("failed");
          setError("Timed out waiting for job to finish");
          return;
        }

        delayMs = nextDelay(attempt);
        setTimeout(poll, delayMs);
      } catch (err) {
        console.error("Poll error:", err);
        if (attempt >= maxAttempts) {
          setStatus("failed");
          setError("Timed out waiting for job to finish");
          return;
        }
        delayMs = nextDelay(attempt);
        setTimeout(poll, delayMs);
      }
    };

    setTimeout(poll, delayMs);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("Upload error:", e);
    setError(e.message || "Upload failed");
    setStatus("failed");
  }
}

export interface UserResumesGetProps {
  userId: string;
}
export async function getUserResumes(userId: string) {
  const config = {
    method: "GET",
    url: `${API_URL}/resumes/${encodeURIComponent(userId)}`,
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
  };
  const response = await axios<GetUserResumesResponse>(config);
  const data = response?.data;

  return data;
}
