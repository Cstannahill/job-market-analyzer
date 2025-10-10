import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const SOURCE_TABLE = process.env.SOURCE_TABLE ?? "job-postings-enhanced";
const STATS_TABLE = process.env.STATS_TABLE ?? "job-postings-stats";
// default to lowercase 'id' which is the actual primary key for the stats table
const STATS_PK = process.env.STATS_PK_NAME ?? "id";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

type Counts = Record<string, number>;

export const handler = async (): Promise<any> => {
  console.log("calculate-job-stats starting", { SOURCE_TABLE, STATS_TABLE });

  let ExclusiveStartKey: Record<string, unknown> | undefined = undefined;

  let totalPostings = 0;
  let totalTechnologies = 0;
  let totalSkills = 0;
  const techCounts: Counts = {};
  const skillCounts: Counts = {};

  try {
    do {
      const resp = await ddb.send(
        new ScanCommand({
          TableName: SOURCE_TABLE,
          // include the actual primary key 'jobId' so LastEvaluatedKey and projections work correctly
          ProjectionExpression: "#jobId, technologies, skills",
          ExpressionAttributeNames: { "#jobId": "jobId" },
          ExclusiveStartKey,
          Limit: 1000, // scan in chunks
        })
      );

      const items = resp.Items ?? [];
      totalPostings += items.length;

      for (const it of items) {
        // technologies may be stored under 'technologies' as an array
        const technologies = Array.isArray(it.technologies)
          ? it.technologies
          : [];
        const skills = Array.isArray(it.skills) ? it.skills : [];

        totalTechnologies += technologies.length;
        totalSkills += skills.length;

        for (const t of technologies) {
          const key = String(t).toLowerCase();
          techCounts[key] = (techCounts[key] || 0) + 1;
        }

        for (const s of skills) {
          const key = String(s).toLowerCase();
          skillCounts[key] = (skillCounts[key] || 0) + 1;
        }
      }

      ExclusiveStartKey = resp.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (ExclusiveStartKey);

    // Build stats item
    const statsItem = {
      [STATS_PK]: "GLOBAL",
      totalPostings,
      totalTechnologies,
      totalSkills,
      technologyCounts: techCounts,
      skillCounts: skillCounts,
      updatedAt: new Date().toISOString(),
    };

    // Validate the stats item contains the expected primary key attribute name
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
    });
    return { status: "ok", totalPostings, totalTechnologies, totalSkills };
  } catch (err) {
    console.error("calculate-job-stats error", err);
    throw err;
  }
};

export default handler;
