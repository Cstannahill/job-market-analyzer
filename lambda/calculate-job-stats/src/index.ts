import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import type {
  JobStats,
  SkillStatItem,
  TechnologyStatItem,
} from "@job-market-analyzer/types";

const STATS_TABLE = process.env.STATS_TABLE ?? "job-postings-stats";
const STATS_PK = process.env.STATS_PK_NAME ?? "id";
const TOP_N = Number(process.env.STATS_TOP_N ?? 500);

const CONNECTION_STRING =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error(
    "DATABASE_URL (or NEON_DATABASE_URL) environment variable must be set"
  );
}

const TABLES = {
  jobs: buildIdentifier(process.env.NEON_JOBS_TABLE ?? "jobs"),
  skills: buildIdentifier(process.env.NEON_SKILLS_TABLE ?? "skills"),
  technologies: buildIdentifier(
    process.env.NEON_TECHNOLOGIES_TABLE ?? "technologies"
  ),
  jobsTechnologies: buildIdentifier(
    process.env.NEON_JOBS_TECHNOLOGIES_TABLE ?? "jobs_technologies"
  ),
};

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: CONNECTION_STRING,
});
const dynamoClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (): Promise<any> => {
  console.log("calculate-job-stats starting");

  try {
    const [
      totalPostings,
      { totalSkills, skills },
      { totalTechnologies, technologies },
    ] = await Promise.all([
      getJobsCount(),
      getSkillStats(),
      getTechnologyStats(),
    ]);

    const statsItem: JobStats = {
      [STATS_PK]: "GLOBAL",
      totalPostings,
      totalSkills,
      totalTechnologies,
      skills,
      technologies,
      updatedAt: new Date().toISOString(),
    };

    if (!(STATS_PK in statsItem)) {
      throw new Error(
        `Stats item missing primary key attribute '${STATS_PK}' - check STATS_PK_NAME env var`
      );
    }

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
    });

    return {
      status: "ok",
      totalPostings,
      totalTechnologies,
      totalSkills,
    };
  } catch (err) {
    console.error("calculate-job-stats error", err);
    throw err;
  }
};

async function getJobsCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::bigint AS count FROM ${TABLES.jobs}`
  );
  const total = parseCount(rows[0]?.count);
  console.log(`Jobs count: ${total}`);
  return total;
}

async function getSimpleCount(tableName: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::bigint AS count FROM ${tableName}`
  );
  return parseCount(rows[0]?.count);
}

async function getTechnologyStats(): Promise<{
  totalTechnologies: number;
  technologies: TechnologyStatItem[];
}> {
  const [totalTechnologies, statsResult] = await Promise.all([
    getTechnologyCount(),
    pool.query<{
      id: string | null;
      name: string | null;
      count: string;
    }>(
      `
        SELECT t.id, t.name, COUNT(*)::bigint AS count
        FROM ${TABLES.jobsTechnologies} jt
        JOIN ${TABLES.technologies} t ON t.id = jt.technology_id
        GROUP BY t.id, t.name
        ORDER BY COUNT(*) DESC, t.name ASC
        LIMIT $1
      `,
      [TOP_N]
    ),
  ]);

  const technologies: TechnologyStatItem[] = statsResult.rows
    .map((row) => {
      const identifier = preferName(row.name, row.id);
      return {
        id: identifier,
        name: row.name ?? undefined,
        count: parseCount(row.count),
      };
    })
    .filter((item) => item.id && item.count > 0);

  console.log(
    `Technologies: ${technologies.length} returned, top: ${technologies[0]?.id} (${technologies[0]?.count})`
  );

  return {
    totalTechnologies,
    technologies,
  };
}

async function getSkillStats(): Promise<{
  totalSkills: number;
  skills: SkillStatItem[];
}> {
  const totalSkills = await getSimpleCount(TABLES.skills);
  console.log(`Skills: total distinct skills ${totalSkills}`);
  return {
    totalSkills,
    skills: [],
  };
}

async function getTechnologyCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(id)::bigint AS count FROM ${TABLES.technologies}`
  );
  return parseCount(rows[0]?.count);
}

function parseCount(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function preferName(
  name: string | null,
  fallbackId: string | null
): string {
  const normalizedName = name?.trim();
  if (normalizedName) return normalizedName;
  const normalizedId = fallbackId?.trim();
  return normalizedId ?? "";
}

function buildIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Table identifier cannot be empty");
  }

  const segments = trimmed.split(".").map((segment) => segment.trim());

  for (const segment of segments) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
      throw new Error(
        `Invalid table identifier segment "${segment}" in value "${value}".`
      );
    }
  }

  return segments.map((segment) => `"${segment}"`).join(".");
}

export default handler;
