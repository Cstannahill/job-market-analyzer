import type { Dispatch, SetStateAction } from "react";
import type { CompareResult } from "@/shared-types";
import axios from "axios";
import type { GetUserResumesResponse } from "@/shared-types/src/resume-query";

const API_URL =
  (import.meta.env.VITE_RESUME_API_URL as string | undefined) || "";

const API_KEY = (import.meta.env.VITE_API_KEY as string | undefined) || "";

export type UploadStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "complete"
  | "failed";

export async function uploadResume(opts: {
  file: File;
  userId: string;
  setStatus: Dispatch<SetStateAction<UploadStatus>>;
  setProgress: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setResult: Dispatch<SetStateAction<CompareResult | null>>;
  apiBase?: string;
  apiKey?: string;
}): Promise<void> {
  const {
    file,
    userId,
    setStatus,
    setProgress,
    setError,
    setResult,
    apiBase = API_URL,
    apiKey = API_KEY,
  } = opts;
  if (!userId) return;
  if (!file) return;

  setStatus("uploading");
  setError(null);
  setProgress(0);

  try {
    // 1) get presigned URL from lambda
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
      console.log("Presigned error:", presignedRes);
      const text = await presignedRes.text().catch(() => "");
      throw new Error(`Failed to get presigned URL${text ? ": " + text : ""}`);
    }

    const { url, key } = (await presignedRes.json()) as {
      url: string;
      key: string;
    };

    // 2) upload to S3 with progress via XHR
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

    // 3) poll compare endpoint
    const poll = async () => {
      try {
        const id = encodeURIComponent(key);
        const response = await fetch(`${apiBase}/resumes/upload/${id}`, {
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
        });

        if (response.ok) {
          const json = (await response.json()) as CompareResult;

          if (json.status === "complete") {
            setResult(json);
            setStatus("complete");
            setProgress(100);
            return;
          }

          if (json.status === "failed") {
            setStatus("failed");
            setError(json.error ?? "Processing failed");
            return;
          }
        }

        // not ready yet: poll again
        setTimeout(poll, 2000);
      } catch (err) {
        console.error("Poll error:", err);
        setTimeout(poll, 2000);
      }
    };

    setTimeout(poll, 1500);
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
