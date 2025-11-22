type TokenReport = {
  tokens: {
    batchTokens: number;
    jobTokens: Array<{ job: number; tokens: number; jobId: string }>;
  };
};

const TOKEN_CHAR_RATIO = 4;
const SEP = "\n\n---\n\n";

function stripHtml(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estTokens(text: string): number {
  const n = Math.ceil((text ?? "").length / TOKEN_CHAR_RATIO);
  return n > 0 ? n : 0;
}

export function logTokenReport(report: TokenReport, label?: string) {
  const out = { label: label ?? "token-report", ...report };
  console.log(JSON.stringify(out));
}
