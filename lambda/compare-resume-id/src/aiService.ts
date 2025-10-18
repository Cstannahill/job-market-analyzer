import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { updateInsights } from "./dbService.js";
import { InsightsItem } from "./types.js";
import {
  extractFirstBalancedJson,
  sanitizeAndParseJson,
} from "./sanitizers.js";

const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  serviceId: "bedrock-runtime",
});
let SELECTED_MODEL = process.env.BEDROCK_MODEL_ID;
const NOVA_MODEL = "amazon.nova-pro-v1:0";

function extractTextFromBedrockResponse(response: any): string {
  // Try several likely places and join content parts safely
  try {
    // 1) Common Converse shape: response.output.message.content -> array of { text }
    const contentArray =
      response?.output?.message?.content ?? response?.output?.content ?? null;

    if (contentArray) {
      // If it's a string, return it
      if (typeof contentArray === "string") return contentArray;

      // If array-like, join text parts
      if (Array.isArray(contentArray)) {
        const parts = contentArray.map((p) => {
          if (!p) return "";
          if (typeof p === "string") return p;
          if (typeof p === "object") {
            // common shape: { text: '...' } or { type: 'output_text', content: [{ text }] }
            if (typeof (p as any).text === "string") return (p as any).text;
            if (Array.isArray((p as any).content)) {
              return (p as any).content
                .map((c: any) =>
                  c?.text ? c.text : typeof c === "string" ? c : ""
                )
                .join("\n");
            }
            return JSON.stringify(p);
          }
          return String(p);
        });
        const joined = parts.join("\n").trim();
        if (joined) return joined;
      }

      // If it's an object with .text
      if (
        typeof contentArray === "object" &&
        typeof (contentArray as any).text === "string"
      ) {
        return (contentArray as any).text;
      }
    }

    // 2) Sometimes response.output is an object with other nested fields, try stringifying fallback
    if (response?.output) return JSON.stringify(response.output);

    // 3) Last resort - stringify entire response
    return JSON.stringify(response);
  } catch (err) {
    return "";
  }
}

// Ensure non-Amazon models use inference profile format
if (
  SELECTED_MODEL &&
  !SELECTED_MODEL.startsWith("amazon.") &&
  !SELECTED_MODEL.startsWith("us.")
) {
  SELECTED_MODEL = `us.${SELECTED_MODEL}`;
}
if (!SELECTED_MODEL) {
  SELECTED_MODEL = NOVA_MODEL;
  console.warn(
    `No Bedrock model configured, defaulting to ${NOVA_MODEL}. Set BEDROCK_MODEL_ID env var to override.`
  );
}

export async function genInsightsWithBedrock(
  resumeText: string,
  resumeId: string
) {
  const MODEL = SELECTED_MODEL;
  const llmPrompt = `
You are an expert hiring manager and resume coach with 10+ years of experience recruiting software engineers across startups and scaleups. Analyze the RESUME_TEXT below and produce a concise, actionable, and machine-friendly JSON report. Do NOT produce any freeform text outside the JSON object.

OVERVIEW:
- Read the resume carefully and base answers only on the content provided.
- Prioritize high-impact, concrete advice that increases hireability for mid-to-senior software engineering roles.
- When making assumptions, mark them explicitly and keep them minimal.

INPUT:
RESUME_TEXT_START
${resumeText.substring(0, 8000)}
RESUME_TEXT_END

OUTPUT FORMAT (required JSON):
Return compact JSON (no pretty-printing or extra whitespace) object with these keys exactly:

{
  "summary": { "oneLine": string, "3line": string },
  "strengths": [ { "text": string, "why": string, "confidence": "high" | "medium" | "low" } ],
  "gaps": [ { "missing": string, "impact": string, "suggestedLearningOrAction": string, "priority": "high" | "medium" | "low" } ],
  "skills": {
    "technical": [ { "name": string, "level": "basic" | "intermediate" | "advanced", "evidenceLine": string } ],
    "soft": [ { "name": string, "evidenceLine": string } ]
  },
  "topRoles": [ { "title": string, "why": string, "fitScore": number } ],
  "achievements": [ { "headline": string, "metric": string | null, "suggestedBullet": string } ],
  "resumeEdits": {
    "titleAndSummary": { "headline": string, "professionalSummary": string },
    "improvedBullets": [ { "old": string | null, "new": string } ]  // produce up to 3 rewritten bullets that use metrics
  },
  "atsAndFormat": { "isATSFriendly": boolean, "recommendations": [string] },
  "confidence": "high" | "medium" | "low",
  "assumptions": [string]
}

INSTRUCTIONS:
1. Keep arrays short and high-value (max 6 items for strengths/gaps/skills).
2. For each "skills.technical" entry, estimate level and include the short text from the resume that supports the estimate in "evidenceLine".
3. For "topRoles" choose 3 roles and give a numeric fitScore 0-100 (rounded integer).
4. For "achievements" create up to 3 crisp headline achievements inferred from the resume; if you cannot infer metrics, suggest realistic metrics to quantify the achievement and mark them as "suggested" in the metric field.
5. In "resumeEdits.improvedBullets" output up to 3 rewritten bullet lines that are action-result-metric oriented and ATS-friendly (use verbs, quantify impact, include tech used).
6. For "atsAndFormat.recommendations" list changes like "add quantifiable metrics", "use reverse-chronological dates", "avoid images/graphics", "use simple fonts", etc.
7. Set "confidence" overall for how complete/clear the resume is based on the provided text.
8. If the input was truncated (you received only part of the resume), add an entry to "assumptions" describing what may be missing.

DO NOT:
- Do not return any markdown, headings, or commentary — only the JSON object.
- Do not invent long stories or external facts not supported by the resume; minimal, labeled assumptions are allowed.

End of instructions.
`;

  try {
    const command = new ConverseCommand({
      modelId: MODEL,
      messages: [{ role: "user", content: [{ text: llmPrompt }] }],
      system: [
        {
          text: "You are an expert resume analyst. Provide detailed, constructive feedback.",
        },
      ],
      inferenceConfig: { temperature: 0.2, maxTokens: 5000 } as any,
    });

    const response = await bedrock.send(command);

    const rawText = extractTextFromBedrockResponse(response).trim();

    if (!rawText) {
      console.error(
        "Empty textual content from Bedrock response. Full response:",
        JSON.stringify(response, null, 2)
      );
      throw new Error("No textual content returned from Bedrock response");
    }

    // Strip fences + normalize whitespace
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Extract first balanced JSON object/array (robust)
    const jsonCandidate = extractFirstBalancedJson(cleaned);
    if (!jsonCandidate) {
      await updateInsights({
        resumeId,
        insightsText: cleaned.slice(0, 10000),
        generatedAt: new Date().toISOString(),
        generatedBy: MODEL || "unknown",
      });
      console.error(
        "LLM output did not contain a balanced JSON object/array. Saved raw cleaned text."
      );
      throw new Error(
        "LLM output did not contain a balanced JSON object/array"
      );
    }

    let parsed: any;
    try {
      parsed = sanitizeAndParseJson(jsonCandidate);
    } catch (err) {
      await updateInsights({
        resumeId,
        insightsText: cleaned.slice(0, 10000),
        generatedAt: new Date().toISOString(),
        generatedBy: MODEL || "unknown",
      });
      console.error("Failed to parse sanitized JSON from model output:", err);
      console.error(
        "JSON candidate snippet:",
        (jsonCandidate || "").slice(0, 1000)
      );
      throw new Error("Failed to parse JSON from model output");
    }

    // Optional lightweight shape check (replace with zod for stricter validation)
    if (typeof parsed !== "object" || parsed === null) {
      await updateInsights({
        resumeId,
        insightsText: JSON.stringify(parsed).slice(0, 10000),
        generatedAt: new Date().toISOString(),
        generatedBy: MODEL || "unknown",
      });
      throw new Error("Parsed JSON is not an object/array");
    }

    // Persist pretty JSON
    await updateInsights({
      resumeId,
      insightsText: JSON.stringify(parsed, null, 2),
      generatedAt: new Date().toISOString(),
      generatedBy: MODEL || "unknown",
    });

    return parsed;
  } catch (error) {
    console.error("Error calling Bedrock model:", error);
    throw error;
  }
}

export async function normalizeSkillsWithBedrock(
  extractedSkills: { technologies: string[]; softSkills: string[] },
  resumeText: string,
  resumeId: string
) {
  const MODEL = SELECTED_MODEL;
  console.log("Using model:", MODEL);

  const prompt = `
You are a resume analyst. Given these technologies and skills extracted from a resume, 
normalize and deduplicate them. Remove duplicates and combine related items.

Extracted Technologies: ${extractedSkills.technologies.join(", ")}
Extracted Soft Skills: ${extractedSkills.softSkills.join(", ")}

Resume context (first 500 chars):
${resumeText.substring(0, 500)}

Return ONLY valid JSON with no markdown formatting, nothing else:
{
  "technologies": ["skill1", "skill2"],
  "softSkills": ["skill1", "skill2"],
  "reasoning": "brief explanation of normalization"
}
  `;

  const command = new ConverseCommand({
    modelId: MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            text: prompt || "",
          },
        ],
      },
    ],
  } as const);

  const response = await bedrock.send(command);
  const content =
    typeof response.output?.message?.content?.[0]?.text === "string"
      ? response.output.message.content[0].text
      : "{}";

  try {
    // Strip markdown code blocks if present
    let jsonString = content.trim();
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    const normalized = JSON.parse(jsonString);
    console.log("Normalized skills:", normalized);
    return normalized;
  } catch (e) {
    console.error("Failed to parse LLM response:", e);
    console.error("Raw response was:", content);
    return extractedSkills; // fallback to raw extraction
  }
}
