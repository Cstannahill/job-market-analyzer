import type { JobRecord } from "./types.js";

type TokenReport = {
  tokens: {
    batchTokens: number;
    jobTokens: Array<{ job: number; tokens: number; jobId: string }>;
  };
};

const TOKEN_CHAR_RATIO = 4; // ≈ chars per token for Gemini
const SEP = "\n\n---\n\n";

// Very basic HTML stripper to avoid inflating counts with markup.
function stripHtml(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 4 chars ≈ 1 token; clamp to 0+
function estTokens(text: string): number {
  const n = Math.ceil((text ?? "").length / TOKEN_CHAR_RATIO);
  return n > 0 ? n : 0;
}

export function estimateTokensWithPromptBuilder(
  jobs: JobRecord[],
  buildUserPrompt: (jobs: JobRecord[]) => string,
  opts?: { systemPrompt?: string; label?: string }
) {
  const system =
    opts?.systemPrompt ??
    "You are a job posting analyzer. Output ONLY valid JSON (an array).";

  const batchUser = buildUserPrompt(jobs);
  const batchTokens = estTokens(system + "\n" + batchUser);

  const jobTokens = jobs.map((job, i) => {
    const singleUser = buildUserPrompt([job]);
    const tokens = estTokens(system + "\n" + singleUser);
    return { job: i + 1, jobId: job.jobId, tokens };
  });

  const report = {
    tokens: {
      batchTokens,
      jobTokens,
    },
  };

  const label = opts?.label ?? "token-report";
  console.log(JSON.stringify({ label, ...report }));
  return report;
}

// Nice single-line JSON log
export function logTokenReport(report: TokenReport, label?: string) {
  const out = { label: label ?? "token-report", ...report };
  console.log(JSON.stringify(out));
}
