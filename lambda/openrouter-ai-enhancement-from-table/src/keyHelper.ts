import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.KEY_USAGE_TABLE || "open-router-keys-status";

const ddb = new DynamoDBClient({ region: REGION });

function getUtcDayOfYear(d = new Date()): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - start) / 86400000) + 1;
}

function getPkForToday(): number {
  const d = new Date();
  const yr = d.getUTCFullYear();
  const doy = getUtcDayOfYear(d);
  return yr * 1000 + doy;
}

export async function incrementKeyUsage(
  keySlot: 1 | 2 | 3 | 4 | 5
): Promise<number> {
  const pk = getPkForToday();
  const d = new Date();
  const yr = d.getUTCFullYear();
  const doy = getUtcDayOfYear(d);

  const attrName = `Key${keySlot}`;
  const cmd = new UpdateItemCommand({
    TableName: TABLE,
    Key: { PK: { N: String(pk) } },
    UpdateExpression: `
      SET #Year = if_not_exists(#Year, :yr),
          #Day  = if_not_exists(#Day,  :doy)
      ADD #K :one
    `
      .replace(/\s+/g, " ")
      .trim(),
    ExpressionAttributeNames: {
      "#Year": "Year",
      "#Day": "Day",
      "#K": attrName,
    },
    ExpressionAttributeValues: {
      ":yr": { N: String(yr) },
      ":doy": { N: String(doy) },
      ":one": { N: "1" },
    },
    ReturnValues: "UPDATED_NEW",
  });

  const res = await ddb.send(cmd);
  const newVal = res.Attributes?.[attrName]?.N;
  return newVal ? Number(newVal) : 0;
}

export async function markRateLimitFirstHit(
  keySlot: 1 | 2 | 3 | 4 | 5,
  countAt429: number
): Promise<void> {
  const pk = getPkForToday();
  const rlName = `Key${keySlot}RateLimit`;

  const cmd = new UpdateItemCommand({
    TableName: TABLE,
    Key: { PK: { N: String(pk) } },
    UpdateExpression: `SET #RL = if_not_exists(#RL, :val)`,
    ExpressionAttributeNames: { "#RL": rlName },
    ExpressionAttributeValues: { ":val": { N: String(countAt429) } },
  });

  await ddb.send(cmd);
}
