import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const ENRICHED_TABLE = process.env.ENRICHED_TABLE || "job-postings-enhanced";
const TRENDS_TABLE = process.env.TRENDS_TABLE || "skill-trends";
const LOOKBACK_HOURS = parseInt(process.env.LOOKBACK_HOURS || "720");

interface EnrichedJob {
  jobId: string;
  technologies: string[];
  skills: string[];
  seniority_level?: string;
  salary_range?: string;
  remote_status?: string;
  industry?: string;
  processed_date: string;
  // Add location if extracted by LLM
  location?: string;
}

interface SkillAggregate {
  count: number;
  associatedRoles: Map<string, number>;
  cooccurringSkills: Map<string, number>;
  salaries: number[];
  remoteCount: number;
  industries: Map<string, number>;
}

interface TrendRecord {
  PK: string;
  SK: string;
  skill: string;
  region: string;
  seniority_level: string;
  skill_type: string;
  count: number;
  relativeDemand: number;
  associatedRoles: string[];
  cooccurringSkills: Record<string, number>;
  avgSalary: number | null;
  remotePercentage: number;
  topIndustries: string[];
  lastUpdated: string;
}

/**
 * Lambda handler - triggered by EventBridge schedule
 */
export const handler = async () => {
  try {
    // Step 1: Scan for recent enriched jobs
    const cutoffTime = new Date(
      Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000
    ).toISOString();
    const jobs = await fetchRecentJobs(cutoffTime);

    if (jobs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No jobs to aggregate" }),
      };
    }

    // Step 2: Aggregate by skill/region/seniority
    const aggregates = aggregateSkills(jobs);

    // Step 3: Convert to trend records
    const totalJobs = jobs.length;
    const trendRecords = buildTrendRecords(aggregates, totalJobs);

    // Step 4: Batch write to DynamoDB
    await batchWriteTrends(trendRecords);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Skill trends aggregated",
        jobsProcessed: jobs.length,
        trendsCreated: trendRecords.length,
      }),
    };
  } catch (error) {
    console.error("Aggregation error:", error);
    throw error;
  }
};

/**
 * Fetch jobs processed within the lookback window
 */
async function fetchRecentJobs(cutoffTime: string): Promise<EnrichedJob[]> {
  const jobs: EnrichedJob[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const command = new ScanCommand({
      TableName: ENRICHED_TABLE,
      FilterExpression: "#processedDate >= :cutoff",
      ExpressionAttributeNames: {
        "#processedDate": "processed_date",
      },
      ExpressionAttributeValues: {
        ":cutoff": cutoffTime,
      },
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);

    if (response.Items) {
      jobs.push(...(response.Items as EnrichedJob[]));
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return jobs;
}

/**
 * Aggregate skills by skill/region/seniority combinations
 */
function aggregateSkills(jobs: EnrichedJob[]): Map<string, SkillAggregate> {
  const aggregates = new Map<string, SkillAggregate>();

  for (const job of jobs) {
    const region = extractRegion(job.location);
    const seniority = normalizeSeniority(job.seniority_level);
    const allSkills = [...(job.technologies || []), ...(job.skills || [])];
    const salary = parseSalary(job.salary_range);
    const isRemote =
      job.remote_status?.toLowerCase().includes("remote") || false;
    const industry = job.industry || "Unknown";

    // Process each skill
    for (const skill of allSkills) {
      let normalizedSkill = skill.toLowerCase().trim();
      normalizedSkill = normalizedSkill
        .replace(
          /^(skill in|knowledge of|experience with|proficiency in)\s+/i,
          ""
        )
        .replace(/\s+(language|framework|library|tool|scripting)$/i, "")
        .trim();
      normalizedSkill = normalizedSkill
        .replace(
          /^(skill in|knowledge of|experience with|proficiency in)\s+/i,
          ""
        )
        .replace(/\s+(language|framework|library|tool|scripting)$/i, "")
        .trim();
      if (normalizedSkill.split(" ").length > 3) continue;
      if (!normalizedSkill) continue;

      const key = `${normalizedSkill}::${region}::${seniority}`;

      let aggregate = aggregates.get(key);
      if (!aggregate) {
        aggregate = {
          count: 0,
          associatedRoles: new Map(),
          cooccurringSkills: new Map(),
          salaries: [],
          remoteCount: 0,
          industries: new Map(),
        };
        aggregates.set(key, aggregate);
      }

      // Increment count
      aggregate.count++;

      // Track co-occurring skills
      for (const otherSkill of allSkills) {
        const normalizedOther = otherSkill.toLowerCase().trim();
        if (normalizedOther !== normalizedSkill) {
          const currentCount =
            aggregate.cooccurringSkills.get(normalizedOther) || 0;
          aggregate.cooccurringSkills.set(normalizedOther, currentCount + 1);
        }
      }

      // Track salary
      if (salary !== null) {
        aggregate.salaries.push(salary);
      }

      // Track remote jobs
      if (isRemote) {
        aggregate.remoteCount++;
      }

      // Track industries
      const currentIndustryCount = aggregate.industries.get(industry) || 0;
      aggregate.industries.set(industry, currentIndustryCount + 1);
    }
  }

  return aggregates;
}

/**
 * Convert aggregates to trend records for DynamoDB
 */
function buildTrendRecords(
  aggregates: Map<string, SkillAggregate>,
  totalJobs: number
): TrendRecord[] {
  const records: TrendRecord[] = [];
  const timestamp = new Date().toISOString();

  for (const [key, aggregate] of aggregates.entries()) {
    const [skill, region, seniority] = key.split("::");

    // Calculate derived metrics
    const avgSalary =
      aggregate.salaries.length > 0
        ? aggregate.salaries.reduce((sum, val) => sum + val, 0) /
          aggregate.salaries.length
        : null;

    const remotePercentage = (aggregate.remoteCount / aggregate.count) * 100;

    const topCooccurring = Array.from(aggregate.cooccurringSkills.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .reduce((obj, [skill, count]) => {
        obj[skill] = count;
        return obj;
      }, {} as Record<string, number>);

    const topIndustries = Array.from(aggregate.industries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([industry]) => industry);

    const skillType = determineSkillType(skill);

    records.push({
      PK: `skill#${skill}`,
      SK: `region#${region}#seniority#${seniority}`,
      skill,
      region,
      seniority_level: seniority,
      skill_type: skillType,
      count: aggregate.count,
      relativeDemand: aggregate.count / totalJobs,
      associatedRoles: [], // Could extract from job titles if needed
      cooccurringSkills: topCooccurring,
      avgSalary,
      remotePercentage,
      topIndustries,
      lastUpdated: timestamp,
    });
  }

  return records;
}

/**
 * Batch write trend records to DynamoDB
 */
async function batchWriteTrends(records: TrendRecord[]): Promise<void> {
  const BATCH_SIZE = 25;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const command = new BatchWriteCommand({
      RequestItems: {
        [TRENDS_TABLE]: batch.map((item) => ({
          PutRequest: {
            Item: item,
          },
        })),
      },
    });

    await docClient.send(command);
  }
}

/**
 * Extract region from location string
 */
function extractRegion(location?: string): string {
  if (!location) return "unknown";

  const loc = location.toLowerCase();

  // US regions
  if (
    loc.includes("us") ||
    loc.includes("united states") ||
    loc.includes("california") ||
    loc.includes("new york") ||
    loc.includes("texas") ||
    loc.includes("washington")
  ) {
    return "us";
  }

  // Europe
  if (
    loc.includes("uk") ||
    loc.includes("united kingdom") ||
    loc.includes("london") ||
    loc.includes("europe")
  ) {
    return "europe";
  }

  // India
  if (
    loc.includes("india") ||
    loc.includes("bangalore") ||
    loc.includes("hyderabad") ||
    loc.includes("mumbai")
  ) {
    return "india";
  }

  // Remote
  if (loc.includes("remote") || loc.includes("worldwide")) {
    return "remote";
  }

  return "other";
}

/**
 * Normalize seniority level
 */
function normalizeSeniority(seniority?: string): string {
  if (!seniority) return "mid";

  const s = seniority.toLowerCase();

  if (s.includes("entry") || s.includes("junior")) return "junior";
  if (s.includes("senior") || s.includes("lead") || s.includes("principal"))
    return "senior";

  return "mid";
}

/**
 * Parse salary from string
 */
function parseSalary(salaryRange?: string): number | null {
  if (!salaryRange) return null;

  // Extract numbers from strings like "$100k-150k" or "$100,000-$150,000"
  const numbers = salaryRange.match(/\d+[,\d]*/g);
  if (!numbers || numbers.length === 0) return null;

  // Take average of range or single value
  const values = numbers.map((n) => parseInt(n.replace(/,/g, "")));
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Determine if skill is a technology or soft skill
 */
function determineSkillType(skill: string): string {
  const techKeywords = [
    "aws",
    "python",
    "javascript",
    "typescript",
    "react",
    "docker",
    "kubernetes",
    "sql",
    "java",
    "node",
    "angular",
    "vue",
    "terraform",
    "mongodb",
    "postgresql",
    "redis",
    "kafka",
    "graphql",
    "api",
  ];

  const skillLower = skill.toLowerCase();

  if (techKeywords.some((tech) => skillLower.includes(tech))) {
    return "technology";
  }

  return "soft_skill";
}
