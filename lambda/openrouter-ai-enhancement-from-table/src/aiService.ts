import axios from "axios";
import {
  getNextApiKeyAsync,
  keyIndexOf,
  maskKey,
  OPENROUTER_KEYS,
} from "./keyManagement.js";
import { logDebug, logError, logInfo, logWarn } from "./logging.js";
import type { EnrichedJobData, JobRecord } from "./types.js";
import { now, sleep, dtStr, keyCooldowns } from "./utils.js";
import { saveEnrichedData, validateEnrichedData } from "./dbService.js";
import { estimateTokensWithPromptBuilder } from "./tokenLogger.js";
import { incrementKeyUsage } from "./keyHelper.js";

//#region Config Env Variables
const OPENROUTER_TIMEOUT_MS = Number(
  process.env.OPENROUTER_TIMEOUT_MS || 10000
);
const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase(); // "debug" | "info" | "warn" | "error"
const DEBUG_PAYLOADS = process.env.DEBUG_PAYLOADS || 0;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "qwen/qwen3-coder:free";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 20);
const BATCH_PAUSE_MS = Number(process.env.BATCH_PAUSE_MS || 2000);

//#endregion

//#region Internal functions used for processing batches

//#region PROMPTFunct
export function buildUserPrompt(jobRecords: JobRecord[]): string {
  const jobsSection = jobRecords
    .map((job, idx) => {
      return `### JOB ${idx + 1}
ID: ${job.jobId}
COMPANY: ${job.company ?? "N/A"}
TITLE: ${job.title ?? "N/A"}
POSTED: ${job.postedDate ?? "N/A"}
LOCATION_RAW: ${job.locationRaw ?? "N/A"}
SOURCES_RAW: ${job.sourcesRaw ?? "N/A"}

DESCRIPTION:
${job.description ?? ""}
`;
    })
    .join("\n---\n\n");

  return `Analyze these ${jobRecords.length} job postings and extract structured information.

${jobsSection}

Return a JSON array with ${jobRecords.length} objects in the same order, following this exact schema:

[
  {
    "jobId": "string (use the ID provided above)",
    "job_title": "string",
    "job_description": "string",
    "technologies": ["array", "of", "strings"],
    "skills": ["array", "of", "strings"],
    "requirements": ["array", "of", "strings"],
    "seniority_level": "Entry|Mid|Senior|Lead|Executive",
    "location": "string or null",
    "company_name": "string or null",
    "salary_mentioned": true|false,
    "salary_range": "string or null",
    "remote_status": "Remote|Hybrid|On-site|Not specified",
    "benefits": ["array", "of", "strings"],
    "company_size": "Startup|Small|Medium|Large|Enterprise or null",
    "industry": "string or null"
  }
    
]`;
}
//#endregion

//#region Single-shot OpenRouter caller (no retries, no splitting)
async function callOpenRouterOnce(payload: any) {
  const apiKey = await getNextApiKeyAsync(); // rotate keys sequentially (no parallel)
  const masked = maskKey(apiKey);
  const slot = ((keyIndexOf(apiKey) ?? 0) + 1) as 1 | 2 | 3 | 4 | 5;
  let countForThisKey = 0;
  try {
    countForThisKey = await incrementKeyUsage(slot);
  } catch (e) {
    // don't block requests if metrics table hiccups
    logWarn("key-usage increment failed (continuing):", e);
  }
  const start = now();
  logInfo(`OpenRouter single call | key=${masked}`);

  try {
    const resp = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // suggested headers by OpenRouter to improve trust/limits:
          "HTTP-Referer": process.env.SITE_URL ?? "https://your.app",
          "X-Title": process.env.SITE_TITLE ?? "Job Market Analyzer",
        },
        timeout: OPENROUTER_TIMEOUT_MS,
      }
    );

    logInfo(`OpenRouter OK in ${dtStr(start)}`);
    applyRateLimitHeaders(resp.headers, apiKey);
    return resp;
  } catch (err: any) {
    const status = err?.response?.status;
    applyRateLimitHeaders(err?.response?.headers ?? {}, apiKey);

    if (status === 429) {
      logWarn(`OpenRouter 429 (no retry) | key=${masked}`);
      err.__rate_limited__ = true; // bubble for logging; we still fail the batch
    } else {
      logWarn(`OpenRouter error (no retry) | status=${status} | key=${masked}`);
    }
    throw err;
  }
}
//#endregion

//#region Enrichment (build prompt, single call, parse/validate)
async function enrichWithOpenRouter(
  jobRecords: JobRecord[],
  run: string
): Promise<EnrichedJobData[]> {
  const systemPrompt = `You are a job posting analyzer that extracts structured data from job descriptions.

CRITICAL: Return ONLY a valid JSON array. No markdown code blocks, no explanations, no preamble.

EXTRACTION RULES:

1. TECHNOLOGIES (technical tools/platforms):
   - Extract specific tools, languages, frameworks, platforms
   - Normalize to lowercase, standard names
   - Examples: "python", "react", "aws", "kubernetes", "postgresql"
   - If a version is mentioned, include it: "python3", "react18"
   - Separate multiple related items: ["aws", "s3", "lambda"] not ["aws s3 lambda"]

2. SKILLS (professional abilities):
   - Extract as SHORT normalized phrases (2-4 words max)
   - Focus on the skill itself, not experience level
   - Examples: "api design", "team leadership", "agile methodology"
   - NOT: "5+ years of API design experience" → USE: "api design"
   - Deduplicate similar skills

3. REQUIREMENTS (qualifications):
   - Extract specific, measurable requirements
   - Include: education, years of experience, certifications, clearances
   - Format consistently: "Bachelor's degree in Computer Science", "5+ years experience", "Security clearance required"
   - Keep it factual, no marketing language

4. SENIORITY_LEVEL:
   - Must be exactly one of: "Entry", "Mid", "Senior", "Lead", "Executive"
   - Infer from: job title, years of experience required, responsibilities
   - Default to "Mid" if ambiguous

5. LOCATION:
   - Extract exact location mentioned in posting
   - Format: "City, State" (US) or "City, Country" (International)
   - If multiple locations: use primary or "Multiple locations"
   - If fully remote: "Remote"
   - If not specified: "Not specified"

6. REMOTE_STATUS:
   - Must be exactly one of: "Remote", "Hybrid", "On-site", "Not specified"
   - Remote: work from anywhere
   - Hybrid: mix of remote and office
   - On-site: must be in office

7. SALARY:
   - salary_mentioned: true if ANY salary info present (even "competitive")
   - salary_range: extract exact figures if given, format as "$XXk-$YYk" or "$XXk+"
   - If only "competitive" mentioned: salary_mentioned=true, salary_range=null

8. BENEFITS:
   - Extract specific benefits mentioned
   - Normalize: "health insurance", "dental insurance", "401k", "unlimited pto", "equity"
   - Exclude vague terms like "competitive benefits"
   - If none mentioned: empty array []

9. COMPANY_NAME:
   - Extract exact company name from posting
   - If not explicitly stated: null (do not guess)

10. COMPANY_SIZE:
    - Must be exactly one of: "Startup", "Small", "Medium", "Large", "Enterprise", null
    - Only infer if there are clear indicators (employee count, "Fortune 500", "seed-stage startup")
    - When in doubt: null

11. INDUSTRY:
    - Single broad category: "technology", "healthcare", "finance", "education", etc.
    - Use lowercase
    - If unclear or multiple: use most prominent

12. JOB_TITLE and JOB_DESCRIPTION:
    - JOB_TITLE: Extract the exact job title as stated in the posting.
    - JOB_DESCRIPTION: Provide a concise summary (1-2 sentences) capturing the essence of the job role and responsibilities.

VALIDATION RULES:
- All array fields must be arrays (even if empty: [])
- No null values in arrays
- No duplicate entries in arrays
- All strings must be trimmed of whitespace
- Boolean fields must be true/false, never null
- Empty/missing data should be null for optional fields, never omit the field

RESPONSE FORMAT:
Return a JSON array with one object per job, maintaining the same order as input.`;
  const userPrompt = buildUserPrompt(jobRecords);

  // token logging (no gating here)
  estimateTokensWithPromptBuilder(jobRecords, buildUserPrompt, {
    label: `run:${run} model:${OPENROUTER_MODEL}`,
    systemPrompt,
  });

  const payload = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    top_p: 0.95,
  };

  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  logDebug(
    `Run ${run} calling OpenRouter | items=${jobRecords.length} | payloadBytes=${payloadBytes}`
  );

  if (DEBUG_PAYLOADS) {
    console.log(
      "---- PROMPT (user) ----\n",
      userPrompt.slice(0, 4000),
      userPrompt.length > 4000
        ? `\n…truncated (${userPrompt.length} chars)`
        : ""
    );
  }

  const t0 = now();
  const response = await callOpenRouterOnce(payload);
  logInfo(
    `Run ${run} OpenRouter OK | ${dtStr(t0)} | choices=${
      response.data?.choices?.length ?? "?"
    }`
  );

  const content: string | undefined =
    response.data?.choices?.[0]?.message?.content ??
    response.data?.choices?.[0]?.delta?.content;

  if (!content) throw new Error("No content in OpenRouter response");

  const cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/g, "")
    .trim();

  if (LOG_LEVEL === "debug") {
    console.log(
      "---- RAW RESPONSE (first 1200 chars) ----\n",
      cleaned.slice(0, 1200)
    );
    if (cleaned.length > 1200) console.log("…truncated raw response");
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed))
    throw new Error("OpenRouter response is not an array");

  return parsed.map((obj: any, idx: number) =>
    validateEnrichedData(obj, jobRecords[idx].jobId)
  );
}
//#endregion

//#region Rate limit header learning (no immediate retries)
function applyRateLimitHeaders(h: Record<string, any>, apiKey: string) {
  const rem = Number(
    h["x-ratelimit-remaining"] ??
      h["X-RateLimit-Remaining"] ??
      h["ratelimit-remaining"]
  );
  const lim = Number(
    h["x-ratelimit-limit"] ?? h["X-RateLimit-Limit"] ?? h["ratelimit-limit"]
  );
  const resetRaw =
    h["x-ratelimit-reset"] ?? h["X-RateLimit-Reset"] ?? h["ratelimit-reset"];

  let resetMs = 0;
  if (resetRaw) {
    const n = Number(resetRaw);
    if (!Number.isNaN(n)) {
      resetMs = n > 1e12 ? n : n * 1000; // treat small numbers as seconds
    } else {
      const d = Date.parse(String(resetRaw));
      if (!Number.isNaN(d)) resetMs = d;
    }
  }

  if (Number.isFinite(rem) && Number.isFinite(lim) && resetMs) {
    logInfo(
      `RateLimit: remaining=${rem} limit=${lim} reset=${new Date(
        resetMs
      ).toISOString()}`
    );
    if (rem <= 0) {
      for (const k of OPENROUTER_KEYS)
        keyCooldowns[k] = Math.max(keyCooldowns[k] ?? 0, resetMs);
    }
  }

  const ra = h["retry-after"] ?? h["Retry-After"];
  if (ra) {
    let retryAfterSec = Number(ra);
    if (Number.isNaN(retryAfterSec)) {
      const d = Date.parse(String(ra));
      if (!Number.isNaN(d))
        retryAfterSec = Math.max(0, (d - Date.now()) / 1000);
    }
    if (retryAfterSec > 0) {
      const until = Date.now() + retryAfterSec * 1000;
      keyCooldowns[apiKey] = Math.max(keyCooldowns[apiKey] ?? 0, until);
      logWarn(
        `Retry-After honored: key cooldown + global gate until ${new Date(
          until
        ).toISOString()}`
      );
    }
  }
}
//#endregion

//#region Public: process batches sequentially (no split, no retry)
export async function processBatches(
  jobRecords: JobRecord[],
  run: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0, batchNo = 1; i < jobRecords.length; batchNo++) {
    const batch = jobRecords.slice(i, i + BATCH_SIZE);
    const ids = batch.map((b) => b.jobId);
    logInfo(
      `Run ${run} batch#${batchNo} start | size=${
        batch.length
      } | ids=${ids.join(",")}`
    );

    try {
      // single-shot call for the whole batch
      const enriched = await enrichWithOpenRouter(batch, run);

      // save immediately per item (batch-scoped, not end-of-run)
      let s = 0,
        f = 0;
      for (const data of enriched) {
        try {
          await saveEnrichedData(data);
          s++;
        } catch (err) {
          f++;
          logError(`save failed jobId=${data.jobId}`, err);
        }
      }
      success += s;
      failed += f;
    } catch (err: any) {
      // Any error (incl. 429) → fail entire batch, no retries/splitting.
      logError(
        `batch#${batchNo} failed (no retry) ids=[${ids.join(",")}]`,
        err?.response?.data ?? err
      );
      failed += batch.length;
    }

    i += BATCH_SIZE;

    // sequential pacing (one batch at a time)
    if (i < jobRecords.length) {
      logInfo(`batch#${batchNo} pause ${BATCH_PAUSE_MS}ms before next batch`);
      await sleep(BATCH_PAUSE_MS);
    }
  }

  return { success, failed };
}
//#endregio
