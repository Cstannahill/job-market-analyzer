import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const CONNECTION_STRING =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error(
    "DATABASE_URL (or NEON_DATABASE_URL) environment variable must be set"
  );
}

neonConfig.webSocketConstructor = ws;

const TABLES = {
  jobs: buildIdentifier(process.env.NEON_JOBS_TABLE ?? "jobs"),
  technologies: buildIdentifier(
    process.env.NEON_TECHNOLOGIES_TABLE ?? "technologies"
  ),
  jobsTechnologies: buildIdentifier(
    process.env.NEON_JOBS_TECHNOLOGIES_TABLE ?? "jobs_technologies"
  ),
};

const pool = new Pool({ connectionString: CONNECTION_STRING });

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type DbJobRow = {
  id: string;
  dynamo_id: string | null;
  job_title: string | null;
  job_description: string | null;
  company_name: string | null;
  location: string | null;
  remote_status: string | null;
  seniority_level: string | null;
  salary_mentioned: boolean | null;
  minimum_salary: number | null;
  maximum_salary: number | null;
  status: string | null;
  processed_date: string | null;
  technologies: string[] | null;
};

type JobPageResponse = {
  success: boolean;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  items: DbJobRow[];
};

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    const qs = event.queryStringParameters ?? {};
    const statusValue = (qs.status ?? "Active").trim() || "Active";
    const pageSize = clampPageSize(
      Number(qs.pageSize ?? qs.limit ?? DEFAULT_PAGE_SIZE)
    );
    const page = Math.max(1, Number(qs.page ?? 1));
    const offset = (page - 1) * pageSize;
    const techFilter = qs.tech?.trim() || null;

    const remoteStatusFilters = parseListParam(qs.remote_status).map(
      mapRemoteFilterValue
    );
    const seniorityFilters = parseListParam(qs.seniority_level).map(
      mapSeniorityFilterValue
    );

    const filterContext: FilterContext = {
      status: statusValue,
      tech: techFilter,
      remoteStatuses: remoteStatusFilters.filter(
        (value): value is string => Boolean(value)
      ),
      seniorityLevels: seniorityFilters.filter(
        (value): value is string => Boolean(value)
      ),
    };

    const { whereClause, values } = buildWhereClause(filterContext);
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::bigint AS count FROM ${TABLES.jobs} j ${whereClause}`,
      values
    );
    const total = parseCount(countResult.rows[0]?.count);
    const totalPages =
      total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize));

    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const paginatedRows = await pool.query<DbJobRow>(
      `
        SELECT
          j.id,
          j.dynamo_id,
          j.job_title,
          j.job_description,
          j.company_name,
          j.location,
          j.remote_status,
          j.seniority_level,
          j.salary_mentioned,
          j.minimum_salary,
          j.maximum_salary,
          j.status,
          j.processed_date,
          COALESCE(techs.technologies, ARRAY[]::text[]) AS technologies
        FROM ${TABLES.jobs} j
        LEFT JOIN LATERAL (
          SELECT array_agg(t.name ORDER BY t.name) AS technologies
          FROM ${TABLES.jobsTechnologies} jt
          JOIN ${TABLES.technologies} t ON t.id = jt.technology_id
          WHERE jt.job_id = j.id
        ) techs ON TRUE
        ${whereClause}
        ORDER BY j.processed_date DESC NULLS LAST, j.id DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      [...values, pageSize, offset]
    );

    const response: JobPageResponse = {
      success: true,
      total,
      totalPages,
      page,
      pageSize,
      items: paginatedRows.rows,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error querying Neon jobs:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch job postings",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

type FilterContext = {
  status: string;
  tech: string | null;
  remoteStatuses: string[];
  seniorityLevels: string[];
};

function buildWhereClause(context: FilterContext): {
  whereClause: string;
  values: Array<string | string[]>;
} {
  const clauses: string[] = [];
  const values: Array<string | string[]> = [];

  const addValue = (value: string | string[]) => {
    values.push(value);
    return values.length;
  };

  clauses.push(`j.status = $${addValue(context.status)}`);

  if (context.remoteStatuses.length) {
    const idx = addValue(context.remoteStatuses);
    clauses.push(`j.remote_status::text = ANY($${idx}::text[])`);
  }

  if (context.seniorityLevels.length) {
    const idx = addValue(context.seniorityLevels);
    clauses.push(`j.seniority_level::text = ANY($${idx}::text[])`);
  }

  if (context.tech) {
    const idx = addValue(context.tech.toLowerCase());
    clauses.push(`
      EXISTS (
        SELECT 1
        FROM ${TABLES.jobsTechnologies} jt
        JOIN ${TABLES.technologies} t ON t.id = jt.technology_id
        WHERE jt.job_id = j.id
          AND LOWER(t.name) = $${idx}
      )
    `);
  }

  const whereClause = clauses.length
    ? `WHERE ${clauses.map((clause) => clause.trim()).join(" AND ")}`
    : "";

  return { whereClause, values };
}

function parseListParam(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mapRemoteFilterValue(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("remote")) return "remote";
  if (normalized.includes("hybrid") || normalized.includes("flex"))
    return "hybrid";
  if (normalized.includes("site") || normalized.includes("office"))
    return "on_site";
  return null;
}

function mapSeniorityFilterValue(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized.includes("junior") ||
    normalized.includes("entry") ||
    normalized.startsWith("jr")
  ) {
    return "junior";
  }
  if (normalized.startsWith("mid") || normalized.includes("associate")) {
    return "mid";
  }
  if (normalized.startsWith("senior") || normalized.startsWith("sr")) {
    return "senior";
  }
  if (normalized.includes("lead") || normalized.includes("principal")) {
    return "lead";
  }
  if (normalized.includes("executive") || normalized.includes("director")) {
    return "executive";
  }
  return null;
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PAGE_SIZE;
  if (value > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return Math.floor(value);
}

function parseCount(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
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
