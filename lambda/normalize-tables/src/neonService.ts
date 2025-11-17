import { Pool, type PoolClient } from "@neondatabase/serverless";
import { insertToggles, isAnyInsertEnabled } from "./config.js";
import type {
  NewCompanyRecord,
  NewIndustryRecord,
  NewSkillRecord,
  NewTechnologyRecord,
  NormalizedJobEntities,
} from "./types.js";
import { uniqueCaseInsensitive } from "./utils.js";

const CONNECTION_STRING =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!CONNECTION_STRING) {
      throw new Error(
        "DATABASE_URL (or NEON_DATABASE_URL) environment variable must be set"
      );
    }
    pool = new Pool({ connectionString: CONNECTION_STRING });
  }
  return pool;
}

async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertCompany(
  client: PoolClient,
  company: NewCompanyRecord | null
): Promise<string | null> {
  if (!company) return null;

  const result = await client.query<{
    id: string;
  }>(
    `
      INSERT INTO companies (name, size)
      VALUES ($1, $2::company_size)
      ON CONFLICT (name)
      DO UPDATE SET size = COALESCE(EXCLUDED.size, companies.size)
      RETURNING id
    `,
    [company.name, company.size]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  const fallback = await client.query<{ id: string }>(
    `SELECT id FROM companies WHERE name = $1`,
    [company.name]
  );
  return fallback.rows[0]?.id ?? null;
}

async function upsertJob(
  client: PoolClient,
  entities: NormalizedJobEntities
): Promise<string> {
  const job = entities.job;
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO jobs (
        dynamo_id,
        processed_date,
        company_name,
        job_description,
        job_title,
        location,
        remote_status,
        salary_mentioned,
        minimum_salary,
        maximum_salary,
        seniority_level,
        status,
        source,
        source_url,
        years_exp_req
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::remote_status,
        $8,
        $9,
        $10,
        $11::seniority_levels,
        $12,
        $13::source,
        $14,
        $15
      )
      ON CONFLICT (dynamo_id)
      DO UPDATE SET
        processed_date = EXCLUDED.processed_date,
        company_name = EXCLUDED.company_name,
        job_description = EXCLUDED.job_description,
        job_title = EXCLUDED.job_title,
        location = EXCLUDED.location,
        remote_status = EXCLUDED.remote_status,
        salary_mentioned = EXCLUDED.salary_mentioned,
        minimum_salary = EXCLUDED.minimum_salary,
        maximum_salary = EXCLUDED.maximum_salary,
        seniority_level = EXCLUDED.seniority_level,
        status = EXCLUDED.status,
        source = EXCLUDED.source,
        source_url = EXCLUDED.source_url,
        years_exp_req = EXCLUDED.years_exp_req
      RETURNING id
    `,
    [
      job.dynamoId,
      job.processedDate,
      job.companyName,
      job.jobDescription,
      job.jobTitle,
      job.location,
      job.remoteStatus,
      job.salaryMentioned,
      job.minimumSalary,
      job.maximumSalary,
      job.seniorityLevel,
      job.status,
      job.source,
      job.sourceUrl,
      job.yearsExpReq,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error(`Failed to upsert job for dynamoId ${job.dynamoId}`);
  }

  return result.rows[0].id;
}

async function upsertTechnology(
  client: PoolClient,
  technology: NewTechnologyRecord
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO technologies (name, type)
      VALUES ($1, $2)
      ON CONFLICT (name)
      DO UPDATE SET type = COALESCE(EXCLUDED.type, technologies.type)
      RETURNING id
    `,
    [technology.name, technology.type]
  );
  return result.rows[0].id;
}

async function upsertSkill(
  client: PoolClient,
  skill: NewSkillRecord
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO skills (name)
      VALUES ($1)
      ON CONFLICT (name)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [skill.name]
  );
  return result.rows[0].id;
}

async function upsertSkills(
  client: PoolClient,
  skills: NewSkillRecord[]
): Promise<void> {
  const uniqueSkills = uniqueCaseInsensitive(skills.map((skill) => skill.name));

  for (const skillName of uniqueSkills) {
    await upsertSkill(client, { name: skillName });
  }
}

async function upsertIndustry(
  client: PoolClient,
  industry: NewIndustryRecord
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO industries (name)
      VALUES ($1)
      ON CONFLICT (name)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [industry.name]
  );
  return result.rows[0].id;
}

async function upsertIndustries(
  client: PoolClient,
  industries: NewIndustryRecord[]
): Promise<void> {
  const uniqueIndustries = uniqueCaseInsensitive(
    industries.map((industry) => industry.name)
  );

  for (const industryName of uniqueIndustries) {
    await upsertIndustry(client, { name: industryName });
  }
}

async function fetchTechnologyIds(
  client: PoolClient,
  technologies: NewTechnologyRecord[]
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const technologyNames = uniqueCaseInsensitive(
    technologies.map((tech) => tech.name)
  );

  if (technologyNames.length === 0) {
    return mapping;
  }

  const result = await client.query<{ id: string; name: string }>(
    `
      SELECT id, name
      FROM technologies
      WHERE name = ANY($1::text[])
    `,
    [technologyNames]
  );

  for (const row of result.rows) {
    mapping.set(row.name, row.id);
  }

  return mapping;
}

async function upsertTechnologies(
  client: PoolClient,
  technologies: NewTechnologyRecord[]
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();

  for (const technology of technologies) {
    const id = await upsertTechnology(client, technology);
    mapping.set(technology.name, id);
  }

  return mapping;
}

async function getJobIdByDynamoId(
  client: PoolClient,
  dynamoId: string
): Promise<string | null> {
  if (!dynamoId) return null;
  const result = await client.query<{ id: string }>(
    `SELECT id FROM jobs WHERE dynamo_id = $1`,
    [dynamoId]
  );
  return result.rows[0]?.id ?? null;
}

async function refreshJobTechnologies(
  client: PoolClient,
  jobId: string,
  technologyIds: string[]
): Promise<void> {
  await client.query(`DELETE FROM jobs_technologies WHERE job_id = $1`, [
    jobId,
  ]);

  if (technologyIds.length === 0) return;

  const valuePlaceholders = technologyIds
    .map((_, index) => `($1, $${index + 2})`)
    .join(", ");

  await client.query(
    `
      INSERT INTO jobs_technologies (job_id, technology_id)
      VALUES ${valuePlaceholders}
      ON CONFLICT (job_id, technology_id) DO NOTHING
    `,
    [jobId, ...technologyIds]
  );
}

export async function upsertNormalizedJob(
  entities: NormalizedJobEntities
): Promise<{ jobId: string }> {
  if (!isAnyInsertEnabled) {
    console.info(
      `All Neon insert toggles disabled; skipping persistence for dynamoId ${entities.job.dynamoId}.`
    );
    return { jobId: entities.job.dynamoId };
  }

  return withTransaction(async (client) => {
    const {
      companies: insertCompanies,
      jobs: insertJobs,
      technologies: insertTechnologies,
      jobTechnologies: insertJobTechnologies,
      skills: insertSkills,
      industries: insertIndustries,
    } = insertToggles;

    if (!insertCompanies) {
      console.debug(
        `Skipping company upsert for dynamoId ${entities.job.dynamoId}; ENABLE_INSERT_COMPANIES is disabled.`
      );
    } else {
      await upsertCompany(client, entities.company);
    }

    if (entities.skills.length > 0) {
      if (!insertSkills) {
        console.debug(
          `Skipping ${entities.skills.length} skill record(s); ENABLE_INSERT_SKILLS is disabled.`
        );
      } else {
        await upsertSkills(client, entities.skills);
      }
    }

    if (entities.industries.length > 0) {
      if (!insertIndustries) {
        console.debug(
          `Skipping ${entities.industries.length} industry record(s); ENABLE_INSERT_INDUSTRIES is disabled.`
        );
      } else {
        await upsertIndustries(client, entities.industries);
      }
    }

    let jobId: string | null = null;

    if (!insertJobs) {
      console.debug(
        `Skipping job upsert for dynamoId ${entities.job.dynamoId}; ENABLE_INSERT_JOBS is disabled.`
      );
      if (insertJobTechnologies) {
        jobId = await getJobIdByDynamoId(client, entities.job.dynamoId);
        if (!jobId) {
          console.warn(
            `Job insert disabled and no existing job found for dynamoId ${entities.job.dynamoId}; skipping job technology relationship updates.`
          );
        }
      }
    } else {
      jobId = await upsertJob(client, entities);
    }

    let technologyMap = new Map<string, string>();

    if (!insertTechnologies) {
      console.debug(
        `Skipping technology upserts for dynamoId ${entities.job.dynamoId}; ENABLE_INSERT_TECHNOLOGIES is disabled.`
      );
      if (insertJobTechnologies && entities.technologies.length > 0) {
        technologyMap = await fetchTechnologyIds(client, entities.technologies);
        if (technologyMap.size === 0) {
          console.warn(
            `No existing technologies found while ENABLE_INSERT_TECHNOLOGIES is disabled; job technology relationships will be skipped.`
          );
        }
      }
    } else {
      technologyMap = await upsertTechnologies(client, entities.technologies);
    }

    if (insertJobTechnologies && jobId) {
      const technologyIds = entities.technologies
        .map((tech) => technologyMap.get(tech.name))
        .filter((id): id is string => !!id);

      if (technologyIds.length === 0) {
        console.debug(
          `No technology IDs resolved for dynamoId ${entities.job.dynamoId}; skipping job technology linkage.`
        );
      } else {
        await refreshJobTechnologies(client, jobId, technologyIds);
      }
    } else if (!insertJobTechnologies) {
      console.debug(
        `Skipping job technology relationships for dynamoId ${entities.job.dynamoId}; ENABLE_INSERT_JOB_TECHNOLOGIES is disabled.`
      );
    }

    return { jobId: jobId ?? entities.job.dynamoId };
  });
}
