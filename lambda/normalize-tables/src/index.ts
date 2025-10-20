import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

type Nullable<T> = T | null | undefined;

const SOURCE_TABLE = "job-postings-enhanced";
const TECH_TABLE = "job-postings-technologies";
const SKILLS_TABLE = "job-postings-skills";
const BENEFITS_TABLE = "job-postings-benefits";
const REQUIREMENTS_TABLE = "job-postings-requirements";
const INDUSTRIES_TABLE = "job-postings-industries";
const NORMALIZED_TABLE = "job-postings-normalized";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

interface Posting extends Record<string, any> {}
interface IndexEntry {
  Id: string;
  name: string;
  count: number;
}

/* ---------- normalization rules ---------- */
const NORMALIZATION_RULES: Array<[RegExp, string]> = [
  [/^react(?:\.js|js)?$/, "React"],
  [/^vue(?:\.js|js)?$/, "Vue"],
  [/^angular(?:\.js|js)?$/, "Angular"],
  [/^next(?:\.js|js)?$/, "Next.js"],
  [/^nuxt(?:\.js|js)?$/, "Nuxt"],
  [/^svelte(?:\.js|js)?$/, "Svelte"],
  [/^python$/, "Python"],
  [/^django$/, "Django"],
  [/^fastapi$/, "FastAPI"],
  [/^flask$/, "Flask"],
  [/^pytorch$/, "PyTorch"],
  [/^tensorflow$/, "TensorFlow"],
  [/^node(?:\.?js)?$/, "Node.js"],
  [/^express(?:\.js|js)?$/, "Express"],
  [/^postgre?sql$/, "PostgreSQL"],
  [/^mongo(?:db)?$/, "MongoDB"],
  [/^redis$/, "Redis"],
  [/^mysql$/, "MySQL"],
  [/^dynamodb$/, "DynamoDB"],
  [/^elasticsearch$/, "Elasticsearch"],
  [/^aws$/, "AWS"],
  [/^gcp$/, "GCP"],
  [/^azure$/, "Azure"],
  [/^docker$/, "Docker"],
  [/^kubernetes$/, "Kubernetes"],
  [/^java(?:script)?$/, "JavaScript"],
  [/^type(?:script)?$/, "TypeScript"],
  [/^c#$/, "C#"],
  [/^c\+\+$/, "C++"],
  [/^golang|go$/, "Go"],
  [/^rust$/, "Rust"],
  [/^git$/, "Git"],
  [/^jenkins$/, "Jenkins"],
  [/^github$/, "GitHub"],
  [/^gitlab$/, "GitLab"],
];

/* ---------- Utilities ---------- */

export function normalizeTerm(term: any): Nullable<string> {
  if (!term || typeof term !== "string") return null;
  const original = term.trim();
  if (!original) return null;

  const cleaned = original.toLowerCase().replace(/[\s\-_\.]+/g, "");
  if (!cleaned) return null;

  for (const [regex, canonical] of NORMALIZATION_RULES) {
    if (regex.test(cleaned)) return canonical;
  }

  const parts = original.split(".").map((p) => {
    const trimmed = p.trim();
    return trimmed
      ? trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase()
      : "";
  });
  return parts.join(".");
}

export function getIdFromName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "");
}

export function normalizeIndustry(industry: any): string[] {
  if (!industry || typeof industry !== "string") return [];
  let normalized = industry;
  normalized = normalized.replace(/\s+and\s+/gi, "|");
  normalized = normalized.replace(/\s*\/\s*/g, "|");
  normalized = normalized.replace(/\s*&\s*/g, "|");
  const parts = normalized
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  const titled = parts.map((p) =>
    p.replace(
      /\w\S*/g,
      (txt) => txt[0].toUpperCase() + txt.slice(1).toLowerCase()
    )
  );
  return Array.from(new Set(titled));
}

export function parseProcessedDate(val: any): Nullable<Date> {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    try {
      return new Date(val * 1000);
    } catch {
      return null;
    }
  }

  const s = String(val).trim();
  if (!s) return null;

  const isoTry = Date.parse(s);
  if (!isNaN(isoTry)) {
    return new Date(isoTry);
  }

  const fmt1 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  const fmt2 = /^\d{4}-\d{2}-\d{2}$/;
  if (fmt1.test(s)) {
    const dt = new Date(s.replace(" ", "T") + "Z");
    if (!isNaN(dt.getTime())) return dt;
  }
  if (fmt2.test(s)) {
    const dt = new Date(s + "T00:00:00Z");
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

export function normalizeAndCollect(
  itemsList: any
): [string[], Record<string, IndexEntry>] {
  if (!Array.isArray(itemsList)) return [[], {}];
  const normalizedMap: Record<string, IndexEntry> = {};
  for (const item of itemsList) {
    if (!item) continue;
    const canonical = normalizeTerm(item);
    if (canonical) {
      if (!normalizedMap[canonical]) {
        normalizedMap[canonical] = {
          Id: getIdFromName(canonical),
          name: canonical,
          count: 0,
        };
      }
    }
  }
  return [Object.keys(normalizedMap), normalizedMap];
}

/* ---------- DynamoDB helpers ---------- */
async function batchPutItems(
  tableName: string,
  items: Record<string, any>[]
): Promise<void> {
  if (!items || items.length === 0) return;
  const CHUNK = 25;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const requestItems: Record<string, any[]> = {
      [tableName]: chunk.map((it) => ({ PutRequest: { Item: it } })),
    };
    try {
      await docClient.send(
        new BatchWriteCommand({ RequestItems: requestItems })
      );
    } catch (err) {
      console.error(
        `Batch write to ${tableName} failed for chunk starting at ${i}:`,
        err
      );
      // continue on error (mirrors original Python approach of logging and continuing)
    }
  }
}

/* ---------- Migration logic with skipping normalized postings ---------- */

export async function migratePostings(): Promise<boolean> {
  console.log("=".repeat(60));
  console.log("Starting migration: job-postings-enhanced → normalized tables");
  console.log("=".repeat(60));

  const techIndex: Record<string, IndexEntry> = {};
  const skillIndex: Record<string, IndexEntry> = {};
  const benefitsIndex: Record<string, IndexEntry> = {};
  const requirementsIndex: Record<string, IndexEntry> = {};
  const industriesIndex: Record<string, IndexEntry> = {};

  let postingsProcessed = 0;
  let skippedNormalized = 0;
  const scannedItems: Posting[] = [];

  try {
    // Scan source table with pagination
    let ExclusiveStartKey: any = undefined;
    do {
      const resp = await docClient.send(
        new ScanCommand({
          TableName: SOURCE_TABLE,
          ExclusiveStartKey,
        })
      );
      const items = (resp.Items as Posting[]) || [];
      console.log(`Scan retrieved ${items.length} items`);
      scannedItems.push(...items);
      ExclusiveStartKey = (resp as any).LastEvaluatedKey;
    } while (ExclusiveStartKey);

    // NEW: skip items that already have normalized === true
    // The original Python had this commented out; we've enabled it.
    const isAlreadyNormalized = (p: Posting) =>
      p?.normalized === true || p?.normalized === "true";

    // Count skipped and keep only un-normalized postings for processing
    skippedNormalized = scannedItems.reduce(
      (acc, p) => acc + (isAlreadyNormalized(p) ? 1 : 0),
      0
    );
    const itemsToNormalize = scannedItems.filter(
      (p) => !isAlreadyNormalized(p)
    );

    console.log(`Total scanned: ${scannedItems.length}`);
    console.log(`Skipped (already normalized): ${skippedNormalized}`);
    console.log(`Total items to process: ${itemsToNormalize.length}\n`);

    // Process each posting (only those not already normalized)
    for (const posting of itemsToNormalize) {
      postingsProcessed += 1;

      // technologies
      if (
        Array.isArray(posting?.technologies) &&
        posting.technologies.length > 0
      ) {
        const [normalizedTechs, techData] = normalizeAndCollect(
          posting.technologies
        );
        posting.technologies =
          normalizedTechs.length > 0 ? normalizedTechs : undefined;
        for (const [tech, data] of Object.entries(techData)) {
          if (!techIndex[tech]) techIndex[tech] = data;
          techIndex[tech].count += 1;
        }
      } else {
        delete posting.technologies;
      }

      // skills
      if (Array.isArray(posting?.skills) && posting.skills.length > 0) {
        const [normalizedSkills, skillData] = normalizeAndCollect(
          posting.skills
        );
        posting.skills =
          normalizedSkills.length > 0 ? normalizedSkills : undefined;
        for (const [skill, data] of Object.entries(skillData)) {
          if (!skillIndex[skill]) skillIndex[skill] = data;
          skillIndex[skill].count += 1;
        }
      } else {
        delete posting.skills;
      }

      // benefits
      if (Array.isArray(posting?.benefits) && posting.benefits.length > 0) {
        const [normalizedBenefits, benefitsData] = normalizeAndCollect(
          posting.benefits
        );
        posting.benefits =
          normalizedBenefits.length > 0 ? normalizedBenefits : undefined;
        for (const [benefit, data] of Object.entries(benefitsData)) {
          if (!benefitsIndex[benefit]) benefitsIndex[benefit] = data;
          benefitsIndex[benefit].count += 1;
        }
      } else {
        delete posting.benefits;
      }

      // requirements
      if (
        Array.isArray(posting?.requirements) &&
        posting.requirements.length > 0
      ) {
        const [normalizedRequirements, requirementsData] = normalizeAndCollect(
          posting.requirements
        );
        posting.requirements =
          normalizedRequirements.length > 0
            ? normalizedRequirements
            : undefined;
        for (const [req, data] of Object.entries(requirementsData)) {
          if (!requirementsIndex[req]) requirementsIndex[req] = data;
          requirementsIndex[req].count += 1;
        }
      } else {
        delete posting.requirements;
      }

      // industry
      if (posting?.industry) {
        const industriesList = normalizeIndustry(posting.industry);
        if (industriesList.length > 0) {
          posting.industry = industriesList;
          for (const industry of industriesList) {
            if (!industriesIndex[industry]) {
              industriesIndex[industry] = {
                Id: getIdFromName(industry),
                name: industry,
                count: 0,
              };
            }
            industriesIndex[industry].count += 1;
          }
        } else {
          delete posting.industry;
        }
      } else {
        delete posting.industry;
      }

      if (postingsProcessed % 100 === 0) {
        console.log(`✓ Processed ${postingsProcessed} postings`);
      }
    }

    // Summary of indices
    console.log(
      `\n✓ Processed ${postingsProcessed} total postings (skipped ${skippedNormalized} already normalized)`
    );
    console.log(`✓ Found ${Object.keys(techIndex).length} unique technologies`);
    console.log(`✓ Found ${Object.keys(skillIndex).length} unique skills`);
    console.log(`✓ Found ${Object.keys(benefitsIndex).length} unique benefits`);
    console.log(
      `✓ Found ${Object.keys(requirementsIndex).length} unique requirements`
    );
    console.log(
      `✓ Found ${Object.keys(industriesIndex).length} unique industries`
    );

    // Convert indices to items and batch write them
    const nowIso = () => new Date().toISOString();
    const indexToItems = (index: Record<string, IndexEntry>) =>
      Object.keys(index)
        .sort()
        .map((canonical) => {
          const data = index[canonical];
          return {
            Id: data.Id,
            Name: data.name,
            postingCount: data.count,
            createdAt: nowIso(),
          };
        });

    console.log("\nWriting technology lookup table...");
    await batchPutItems(TECH_TABLE, indexToItems(techIndex));
    console.log(`✓ Wrote ${Object.keys(techIndex).length} technologies`);

    console.log("\nWriting skills lookup table...");
    await batchPutItems(SKILLS_TABLE, indexToItems(skillIndex));
    console.log(`✓ Wrote ${Object.keys(skillIndex).length} skills`);

    console.log("\nWriting benefits lookup table...");
    await batchPutItems(BENEFITS_TABLE, indexToItems(benefitsIndex));
    console.log(`✓ Wrote ${Object.keys(benefitsIndex).length} benefits`);

    console.log("\nWriting requirements lookup table...");
    await batchPutItems(REQUIREMENTS_TABLE, indexToItems(requirementsIndex));
    console.log(
      `✓ Wrote ${Object.keys(requirementsIndex).length} requirements`
    );

    console.log("\nWriting industries lookup table...");
    await batchPutItems(INDUSTRIES_TABLE, indexToItems(industriesIndex));
    console.log(`✓ Wrote ${Object.keys(industriesIndex).length} industries`);

    // Write normalized postings (only those we processed)
    console.log("\nWriting normalized postings...");
    const normalizedItems: Record<string, any>[] = [];
    let normalizedCount = 0;

    const firstPresent = (
      posting: Posting,
      keys: string[],
      defaultVal: any = null
    ) => {
      for (const k of keys) {
        if (k in posting && posting[k] !== undefined && posting[k] !== null)
          return posting[k];
      }
      return defaultVal;
    };

    // reuse the same itemsToNormalize from earlier
    // (we declared it above as const and used it for processing)
    // so reconstruct variable reference by filtering scannedItems again is unnecessary —
    // instead, reuse the previously computed list `itemsToNormalize`.
    // However TypeScript scope doesn't expose that name here, so we'll recompute once into a new const reference
    // to avoid accidental redeclare in the same scope. Use a new name `normalizedTargets`.
    const normalizedTargets = scannedItems.filter(
      (p) => !(p?.normalized === true || p?.normalized === "true")
    );

    for (const postingRaw of normalizedTargets) {
      const posting = { ...postingRaw };

      if (!("Id" in posting) && "jobId" in posting) posting.Id = posting.jobId;

      posting.company_size = posting.company_size ?? "Unknown";
      posting.salary_mentioned = posting.salary_mentioned ?? false;
      posting.salary_range = posting.salary_range ?? "Unknown";
      posting.seniority_level = posting.seniority_level ?? "Unknown";

      const procDt = parseProcessedDate(posting.processed_date);
      if (!("status" in posting) && procDt) {
        const now = new Date();
        const diffMs = now.getTime() - procDt.getTime();
        const days = diffMs / (1000 * 60 * 60 * 24);
        if (days <= 30) posting.status = "Active";
      }

      const jobTitle = firstPresent(
        posting,
        ["job_title", "title", "jobTitle", "position"],
        "Unknown Title"
      );
      const jobDescription = firstPresent(
        posting,
        ["job_description", "description", "jobDescription", "details"],
        ""
      );
      const companyName = firstPresent(
        posting,
        ["company_name", "company", "employer"],
        null
      );
      const location = firstPresent(
        posting,
        ["location", "job_location"],
        null
      );
      const remoteStatus = firstPresent(
        posting,
        ["remote_status", "remote"],
        null
      );

      const NormalizedItem: Record<string, any> = {
        Id: posting.Id,
        job_title: jobTitle,
        job_description: jobDescription,
        normalized: true,
        normalized_at: new Date().toISOString(),
        processed_date: posting.processed_date,
        company_name: companyName,
        company_size: posting.company_size ?? "Unknown",
        location,
        remote_status: remoteStatus,
        salary_mentioned: posting.salary_mentioned ?? false,
        salary_range: posting.salary_range ?? "Unknown",
        seniority_level: posting.seniority_level ?? "Unknown",
        status: posting.status ?? "Active",
      };

      if (posting.technologies)
        NormalizedItem.technologies = posting.technologies;
      if (posting.skills) NormalizedItem.skills = posting.skills;
      if (posting.benefits) NormalizedItem.benefits = posting.benefits;
      if (posting.requirements)
        NormalizedItem.requirements = posting.requirements;
      if (posting.industry) NormalizedItem.industry = posting.industry;

      normalizedItems.push(NormalizedItem);
      normalizedCount++;
    }

    await batchPutItems(NORMALIZED_TABLE, normalizedItems);
    console.log(`✓ Wrote ${normalizedCount} normalized postings`);

    console.log("\n" + "=".repeat(60));
    console.log("✓ Migration complete!");
    console.log("=".repeat(60));
    console.log("\nSummary:");
    console.log(`  • Total scanned: ${scannedItems.length}`);
    console.log(`  • Postings processed: ${postingsProcessed}`);
    console.log(`  • Skipped (already normalized): ${skippedNormalized}`);
    console.log(`  • Unique technologies: ${Object.keys(techIndex).length}`);
    console.log(`  • Unique skills: ${Object.keys(skillIndex).length}`);
    console.log(`  • Unique benefits: ${Object.keys(benefitsIndex).length}`);
    console.log(
      `  • Unique requirements: ${Object.keys(requirementsIndex).length}`
    );
    console.log(
      `  • Unique industries: ${Object.keys(industriesIndex).length}`
    );

    return true;
  } catch (err) {
    console.error("\n✗ Error during migration:", err);
    return false;
  }
}

export const handler = async (
  event: any = {}
): Promise<{ statusCode: number; body: string }> => {
  console.log(
    "Lambda invoked. Beginning migration (skipping already-normalized postings)..."
  );
  const success = await migratePostings();
  return {
    statusCode: success ? 200 : 500,
    body: JSON.stringify({ success }),
  };
};

export default handler;
