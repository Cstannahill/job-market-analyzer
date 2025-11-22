import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { getTopTechnologies, updateInsights } from "./dbService.js";
import { InsightsItem, type EnrichedSkillData } from "./types.js";
import {
  extractFirstBalancedJson,
  sanitizeAndParseJson,
} from "./sanitizers.js";
import { v4 as uuidv4 } from "uuid";
import { summarizeSkillData } from "./techTrends.js";

const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  serviceId: "bedrock-runtime",
});
let SELECTED_MODEL = process.env.BEDROCK_MODEL_ID;
const NOVA_MODEL = "amazon.nova-pro-v1:0";
const SKILL_NORMALIZATION_MODEL =
  process.env.BEDROCK_NORMALIZATION_MODEL_ID || "amazon.nova-micro-v1:0";

if (!SELECTED_MODEL) {
  SELECTED_MODEL = NOVA_MODEL;
  console.warn(
    `No Bedrock model configured, defaulting to ${NOVA_MODEL}. Set BEDROCK_MODEL_ID env var to override.`
  );
}
function extractTextFromBedrockResponse(response: any): string {
  try {
    const contentArray =
      response?.output?.message?.content ?? response?.output?.content ?? null;

    if (contentArray) {
      if (typeof contentArray === "string") return contentArray;

      if (Array.isArray(contentArray)) {
        const parts = contentArray.map((p) => {
          if (!p) return "";
          if (typeof p === "string") return p;
          if (typeof p === "object") {
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

      if (
        typeof contentArray === "object" &&
        typeof (contentArray as any).text === "string"
      ) {
        return (contentArray as any).text;
      }
    }

    if (response?.output) return JSON.stringify(response.output);

    return JSON.stringify(response);
  } catch (err) {
    return "";
  }
}

export async function genInsightsWithBedrock(
  resumeText: string,
  resumeId: string,
  userTechData: EnrichedSkillData[]
) {
  const MODEL = SELECTED_MODEL;
  const insightId = uuidv4();
  const techJson = await getTopTechnologies();
  const enrichedData = summarizeSkillData(userTechData);

  const llmPrompt = `
You are an expert hiring manager and resume coach with 10+ years of experience recruiting software engineers across startups and scaleups. Analyze the RESUME_TEXT below and produce a concise, actionable, and machine-friendly JSON report. Do NOT produce any freeform text outside the JSON object.

OVERVIEW:
- Read the resume carefully and base answers only on the content provided.
- Compare resume skills against current market demand data to identify alignment and gaps.
- Prioritize high-impact, concrete advice that increases hireability for mid-to-senior software engineering roles.
- When making assumptions, mark them explicitly and keep them minimal.

INPUT:
RESUME_TEXT_START
${resumeText.substring(0, 15000)}
RESUME_TEXT_END

CURRENT_MARKET_DATA:
${JSON.stringify(techJson, null, 2)}

This data represents the top ${
    techJson.topSkills.length
  } most in-demand technologies from real job postings.

ENRICHED SALARY & SKILL DATA FOR RESUME SKILLS:
${JSON.stringify(enrichedData, null, 2)}

This data provides deep context on the candidate's EXISTING skills:
1. Salary ranges by seniority level (Junior/Mid/Senior/Lead)
2. Skills that commonly appear together (skill stacks)
3. Common job titles for each skill
4. Market demand (job count) for each skill

Use this to:
1. Identify which resume skills match high-demand technologies
2. Find high-value skills missing from the resume
3. Prioritize gaps based on market demand (higher demand = higher priority)
4. Provide specific, data-driven recommendations
5. Calculate candidate's current market value based on their experience level + skills
6. Show salary potential at different seniority levels
7. Recommend complementary skills based on what naturally pairs with their current stack
8. Identify realistic career paths based on common role progressions
9. Quantify the value of adding missing skills (salary increase)


OUTPUT FORMAT (required JSON):
Return compact JSON (no pretty-printing or extra whitespace) object with these keys exactly:

{
  "summary": { "oneLine": string, "threeLine": string, "overallImpression": string },
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
    "improvedBullets": [ { "old": string | null, "new": string } ]  
  },
  "marketAlignment": {
    "matchedSkills": [ { "skill": string, "demand": number, "onResume": true, "percentile": number } ],
    "missingHighDemandSkills": [ { "skill": string, "demand": number, "priority": "high" | "medium" | "low", "reason": string, "learningPath": string } ],
    "demandScore": number,
    "demandScoreExplanation": string
  },
  "salaryInsights": {
    "currentEstimate": {
      "range": { "min": number, "median": number, "p75": number, "p95": number },
      "level": "junior" | "mid" | "senior" | "lead",
      "reasoning": string
    },
    "potentialGrowth": [
      {
        "targetLevel": "senior" | "lead",
        "estimatedSalary": { "median": number, "p75": number },
        "requiresSkills": [string],
        "timeframe": string
      }
    ],
    "skillROI": [
      {
        "skill": string,
        "currentAvgSalary": number,
        "withSkillAvgSalary": number,
        "increase": number,
        "increasePercentage": number,
        "reasoning": string
      }
    ]
  },
  "skillStacks": {
    "currentStack": {
      "skills": [string],
      "commonPairings": [ { "skill": string, "appearsTogetherPercentage": number } ],
      "completeness": number
    },
    "recommendedStacks": [
      {
        "name": string,
        "description": string,
        "addSkills": [string],
        "projectedFit": number,
        "salaryRange": { "median": number, "p75": number }
      }
    ]
  },
  "atsAndFormat": { "isATSFriendly": boolean, "recommendations": [string] },
  "confidence": "high" | "medium" | "low",
  "assumptions": [string]
}

INSTRUCTIONS:
1. Keep arrays short and high-value (aim for 6 items each for strengths/gaps/skills).
2. For each "skills.technical" entry, estimate level and include the short text from the resume that supports the estimate in "evidenceLine".
3. For "topRoles" choose 3 roles and give a numeric fitScore 0-100 (rounded integer); include suggested level for role such as junior, senior, etc., factoring in ability, experience, as well as years of experience; be practical, less than 5 years of experience should not be recommended a senior level position for instance.
4. For "achievements" create 3 crisp headline achievements inferred from the resume; if you cannot infer metrics, suggest realistic metrics to quantify the achievement and mark them as "suggested" in the metric field.
5. In "resumeEdits.improvedBullets" output up to 5 rewritten bullet lines that are action-result-metric oriented or better replace weak or unclear bullets that are ATS-friendly (use verbs, quantify impact, include tech used).
6. For "atsAndFormat.recommendations" list changes like "add quantifiable metrics", "use reverse-chronological dates", "avoid images/graphics", "use simple fonts", etc. but only if true; also include opinions on structure/format of the information and recommendations on restructuring sections if necessary.
7. Set "confidence" overall for how complete/clear the resume is based on the provided text.
8. If the input was truncated (you received only part of the resume), add an entry to "assumptions" describing what may be missing.
9. The overallImpression property within summary should be based on all information, discerning what you can based on the skills and experience of the developer from your point of view as the hiring manager; this should be the hiring manager's overall impression of the developer.

CRITICAL: GAPS VS MARKET ALIGNMENT DISTINCTION:
10. The "gaps" array is for NON-TECHNICAL career/professional gaps ONLY. Examples include:
    - "Formal education in computer science" 
    - "Quantifiable metrics in achievements"
    - "Team leadership experience"
    - "Open-source contributions"
    - "Mobile development experience" (only if they claim full-stack but have zero mobile)
    - "Production system design at scale"
    - "Public speaking or conference talks"
    - "Technical writing or blogging"
    
    DO NOT include specific technical skills/frameworks in "gaps" - those belong in "marketAlignment.missingHighDemandSkills"

11. For "marketAlignment.matchedSkills": 
    - List skills from the resume that appear in the top 50 market demand data
    - Include the exact demand number from the market data
    - Calculate percentile (e.g., top 5% = 95th percentile)
    - Only include skills with demand > 100

12. For "marketAlignment.missingHighDemandSkills":
    - Identify top 10 high-demand TECHNICAL skills (demand > 200) NOT present on the resume
    - This is where you list: Kubernetes, Docker, Terraform, Go, Ruby, etc.
    - Prioritize based on: demand count + relevance to candidate's existing skill set
    - Set priority as:
      * "high" if demand > 600 AND complements existing skills
      * "medium" if demand 300-600 OR moderately relevant
      * "low" if demand 200-300 OR low relevance
    - Provide specific "reason" explaining why this skill matters for their career path
    - Give actionable "learningPath" (e.g., "Start with AWS EKS, then standalone Kubernetes")

13. For "marketAlignment.demandScore":
    - Calculate: (number of resume skills in top 20 demand / 20) * 100
    - Round to integer
    - Provide clear explanation in "demandScoreExplanation"

SALARY INSIGHTS SECTION
14. For "salaryInsights.currentEstimate":
    - Determine candidate's level based on years of experience + skill depth
    - Use the salary data for their skills at that level
    - Average across their top 3-5 skills for the estimate
    - Explain reasoning clearly (e.g., "3 years experience + Python/React/AWS = mid-level")

15. For "salaryInsights.potentialGrowth":
    - Show 1-2 realistic career progression paths
    - Calculate salary at next level(s) based on their existing skills
    - List specific skills/experience needed to reach that level
    - Provide realistic timeframe (e.g., "12-18 months with leadership experience")

16. For "salaryInsights.skillROI":
    - For top 3-5 missing high-demand skills, calculate salary impact
    - Compare: average salary with current skills vs with skill added
    - Show absolute increase + percentage
    - Explain WHY (e.g., "Kubernetes skills command 15% premium due to cloud-native demand")
    - Rank by ROI (highest salary increase first)

SKILL STACKS SECTION
17. For "skillStacks.currentStack":
    - List candidate's main technical skills
    - Show which skills commonly appear together (use co-occurring data)
    - Calculate "completeness" score: what % of common pairings do they have?
    - Example: If React devs commonly have TypeScript (80%), Docker (60%), AWS (70%)
      and candidate has React + TypeScript + AWS, completeness = 66% (2 of 3 common pairings)

18. For "skillStacks.recommendedStacks":
    - Suggest 2-3 realistic "complete stacks" based on their current skills
    - Name them meaningfully (e.g., "Cloud-Native Full-Stack", "Modern Data Engineer")
    - Show which 1-3 skills would complete each stack
    - Calculate projected fit score
    - Show salary range for roles requiring that complete stack

19. For "salaryInsights.potentialGrowth":
    - Be realistic about timeframes: learning 4 major technologies takes 18-24 months, not 12-18
    - Prioritize skills by ROI and learning difficulty
    - Show a clear sequence: "Learn Kubernetes first (3 months), then Docker (2 months), gain leadership experience concurrently (6-12 months)"
    - Don't overwhelm with too many required skills

20. For "skillStacks.recommendedStacks":
    - Include learning time estimate for each skill
    - Show total learning time for complete stack
    - List common job titles that require this stack
    - Include job count for roles requiring this stack
    - Order skills by priority (highest ROI first)

21. For "topRoles":
    - Include salary range for each role based on candidate's level
    - Show job count for this role with their skills
    - Clearly distinguish "Required" vs "Nice to have" skills
    - Be specific about seniority level (Junior/Mid/Senior/Lead)
    
DO NOT:
- Do not return any markdown, headings, or commentary — only the JSON object.
- Do not invent long stories or external facts not supported by the resume; minimal, labeled assumptions are allowed.
- Do not include technical skills/frameworks in "gaps" - those belong in "marketAlignment.missingHighDemandSkills"
- Do not include skills in "missingHighDemandSkills" if they are already on the resume.
- Do not recommend skills with demand < 200 unless highly relevant to their career trajectory.
- Do not duplicate information between "gaps" and "marketAlignment.missingHighDemandSkills"
- Do not make up salary numbers - use the provided salary data or clearly mark estimates as "estimated"
- Do not suggest unrealistic skill pairings - use the co-occurring skills data

End of instructions.
`;

  console.log(llmPrompt.length, " - Prompt Character count");
  try {
    const command = new ConverseCommand({
      modelId: MODEL,
      messages: [{ role: "user", content: [{ text: llmPrompt }] }],
      system: [
        {
          text: "You are an expert resume analyst. Provide detailed, constructive feedback.",
        },
      ],
      inferenceConfig: { temperature: 0.7, maxTokens: 9800 } as any,
    });

    const response = await bedrock.send(command);
    console.log(String(response).length, "  -- RESPONSE Length");
    const rawText = extractTextFromBedrockResponse(response).trim();

    if (!rawText) {
      console.error(
        "Empty textual content from Bedrock response. Full response:",
        JSON.stringify(response, null, 2)
      );
      throw new Error("No textual content returned from Bedrock response");
    }

    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const jsonCandidate = extractFirstBalancedJson(cleaned);
    if (!jsonCandidate) {
      await updateInsights({
        resumeId,
        insightId: `INSIGHT#${insightId}`,
        insightsText: cleaned,
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
        insightId: `INSIGHT#${insightId}`,
        insightsText: cleaned,
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

    if (typeof parsed !== "object" || parsed === null) {
      await updateInsights({
        resumeId,
        insightId: `INSIGHT#${insightId}`,
        insightsText: JSON.stringify(parsed),
        generatedAt: new Date().toISOString(),
        generatedBy: MODEL || "unknown",
      });
      throw new Error("Parsed JSON is not an object/array");
    }

    await updateInsights({
      resumeId,
      insightId: `INSIGHT#${insightId}`,
      insightsText: JSON.stringify(parsed, null, 2),
      generatedAt: new Date().toISOString(),
      generatedBy: MODEL || "unknown",
    });

    return {
      parsed,
      insightsItem: {
        insightId: `INSIGHT#${insightId}`,
        insightsText: JSON.stringify(parsed, null, 2),
        generatedAt: new Date().toISOString(),
        generatedBy: MODEL || "unknown",
      } as InsightsItem,
    };
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
  const MODEL = SKILL_NORMALIZATION_MODEL;
  console.log("Using skill normalization model:", MODEL);
  console.log(JSON.stringify(extractedSkills));
  const prompt = `
You are a resume analyst. Given these technologies and skills extracted from a resume, 
normalize and deduplicate them. Remove duplicates and combine related items.

Extracted Technologies: ${extractedSkills.technologies.join(", ")}
Extracted Soft Skills: ${extractedSkills.softSkills.join(", ")}

Resume context (first 1000 chars):
${resumeText.substring(0, 1000)}

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
    return extractedSkills;
  }
}
