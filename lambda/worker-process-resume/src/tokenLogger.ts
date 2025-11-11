// import type { JobRecord } from "./types.js";

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

// Nice single-line JSON log
export function logTokenReport(report: TokenReport, label?: string) {
  const out = { label: label ?? "token-report", ...report };
  console.log(JSON.stringify(out));
}
