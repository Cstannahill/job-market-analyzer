import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { JobStats, TechnologyStatItem, SkillStatItem } from "./jobs.js";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const STATS_TABLE = process.env.STATS_TABLE ?? "job-postings-stats";
const STATS_PK = process.env.STATS_PK_NAME ?? "id";

const JOBS_TABLE = process.env.JOBS_TABLE ?? "job-postings-enhanced";
const SKILLS_TABLE = process.env.SKILLS_TABLE ?? "job-postings-skills";
const TECHNOLOGIES_TABLE =
  process.env.TECHNOLOGIES_TABLE ?? "job-postings-technologies";
const REQUIREMENTS_TABLE =
  process.env.REQUIREMENTS_TABLE ?? "job-postings-requirements";
const INDUSTRIES_TABLE =
  process.env.INDUSTRIES_TABLE ?? "job-postings-industries";
const BENEFITS_TABLE = process.env.BENEFITS_TABLE ?? "job-postings-benefits";
const TOP_N = Number(process.env.STATS_TOP_N ?? 500);
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

export const handler = async (): Promise<any> => {
  console.log("calculate-job-stats starting");

  try {
    // Run all scans in parallel for speed
    const [
      totalPostings,
      { totalSkills, skills },
      { totalTechnologies, technologies },
      requirementsCounts,
      industriesCounts,
      benefitCounts,
    ] = await Promise.all([
      getJobsCount(),
      getSkillStats(),
      getTechnologyStats(),
      getTableCount(REQUIREMENTS_TABLE),
      getTableCount(INDUSTRIES_TABLE),
      getTableCount(BENEFITS_TABLE),
    ]);

    // Build stats item matching your JobStats type
    const statsItem: JobStats = {
      [STATS_PK]: "GLOBAL",
      totalPostings,
      totalSkills,
      totalTechnologies,
      skills: skills.slice(0, TOP_N), // Array of { name, count }
      technologies,
      requirementsCounts,
      industriesCounts,
      benefitCounts,
      updatedAt: new Date().toISOString(),
    };

    // Validate the stats item contains the expected primary key
    if (!(STATS_PK in statsItem)) {
      throw new Error(
        `Stats item missing primary key attribute '${STATS_PK}' — check STATS_PK_NAME env var`
      );
    }

    // Write to stats table
    await ddb.send(
      new PutCommand({
        TableName: STATS_TABLE,
        Item: statsItem,
      })
    );

    console.log("calculate-job-stats finished", {
      totalPostings,
      totalTechnologies,
      totalSkills,
      requirementsCounts,
      industriesCounts,
      benefitCounts,
    });

    return {
      status: "ok",
      totalPostings,
      totalTechnologies,
      totalSkills,
      requirementsCounts,
      industriesCounts,
      benefitCounts,
    };
  } catch (err) {
    console.error("calculate-job-stats error", err);
    throw err;
  }
};

/**
 * Get total job count - just count items, no data needed
 */
async function getJobsCount(): Promise<number> {
  let count = 0;
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: JOBS_TABLE,
        Select: "COUNT", // Only return count, don't fetch item data
        ExclusiveStartKey,
      })
    );

    count += resp.Count ?? 0;
    ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  console.log(`Jobs count: ${count}`);
  return count;
}

/**
 * Get simple count for a table (requirements, industries, benefits)
 */
async function getTableCount(tableName: string): Promise<number> {
  let count = 0;
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
        ExclusiveStartKey,
      })
    );

    count += resp.Count ?? 0;
    ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  console.log(`${tableName} count: ${count}`);
  return count;
}

/**
 * Get technology statistics from normalized table
 * Table structure: { technologyId: "python", postingsCount: 150 }
 */
async function getTechnologyStats(): Promise<{
  totalTechnologies: number;
  technologies: TechnologyStatItem[];
}> {
  const technologies: TechnologyStatItem[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: TECHNOLOGIES_TABLE,
        ProjectionExpression: "#Id, postingCount", // Fetch ID and count
        ExpressionAttributeNames: { "#Id": "Id" }, // Id is a reserved word
        ExclusiveStartKey,
      })
    );

    const items = resp.Items ?? [];

    // Build TechnologyStatItem array
    for (const item of items) {
      const id = String(item.Id || "").trim();
      const count = Number(item.postingCount || 0);

      if (id && count > 0) {
        technologies.push({ id, count });
      }
    }

    ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  // Sort by count descending (most popular first)
  technologies.sort((a, b) => b.count - a.count);

  console.log(
    `Technologies: ${technologies.length} unique, top: ${technologies[0]?.name} (${technologies[0]?.count})`
  );

  return {
    totalTechnologies: technologies.length,
    technologies,
  };
}

/**
 * Get skill statistics from normalized table
 * Table structure: { skillId: "api-design", postingsCount: 85 }
 */
async function getSkillStats(): Promise<{
  totalSkills: number;
  skills: SkillStatItem[];
}> {
  const skills: SkillStatItem[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: SKILLS_TABLE,
        ProjectionExpression: "#Id, postingCount", // Fetch ID and count
        ExpressionAttributeNames: { "#Id": "Id" }, // Id is a reserved word
        ExclusiveStartKey,
      })
    );

    const items = resp.Items ?? [];

    // Build SkillStatItem array
    for (const item of items) {
      const id = String(item.Id || "").trim();
      const count = Number(item.postingCount || 0);

      if (id && count > 0) {
        skills.push({ id, count });
      }
    }

    ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  // Sort by count descending (most popular first)
  skills.sort((a, b) => b.count - a.count);

  console.log(
    `Skills: ${skills.length} unique, top: ${skills[0]?.id} (${skills[0]?.count})`
  );

  return {
    totalSkills: skills.length,
    skills,
  };
}

export default handler;
