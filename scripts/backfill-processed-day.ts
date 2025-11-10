// scripts/backfill-processed-day.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = "us-east-1";
const TABLE = "job-postings-enhanced";

function toDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toIsoWeek(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // ISO week calc
  const tmp = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNum = (tmp.getUTCDay() + 6) % 7; // Mon=0
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3); // Thu
  const firstThu = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((tmp.getTime() - firstThu.getTime()) / 86400000 - 3) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function run() {
  const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION })
  );
  let ExclusiveStartKey: Record<string, any> | undefined;

  let updated = 0;
  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ProjectionExpression:
          "jobId, processed_date, processed_day, processed_week",
        ExclusiveStartKey,
      })
    );
    for (const item of page.Items ?? []) {
      const pd: string | undefined = item.processed_date;
      if (!pd) continue;
      const day = toDay(pd);
      const week = toIsoWeek(pd);
      const needsDay = !item.processed_day && day;
      const needsWeek = !item.processed_week && week;
      if (!needsDay && !needsWeek) continue;

      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { jobId: item.jobId },
          UpdateExpression: `SET ${needsDay ? "#d = :d" : ""} ${
            needsDay && needsWeek ? "," : ""
          } ${needsWeek ? "#w = :w" : ""}`.trim(),
          ExpressionAttributeNames: {
            ...(needsDay ? { "#d": "processed_day" } : {}),
            ...(needsWeek ? { "#w": "processed_week" } : {}),
          },
          ExpressionAttributeValues: {
            ...(needsDay ? { ":d": day } : {}),
            ...(needsWeek ? { ":w": week } : {}),
          },
        })
      );
      updated++;
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  console.log(`Updated items: ${updated}`);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
