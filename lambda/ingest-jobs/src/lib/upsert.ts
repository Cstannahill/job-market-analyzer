import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { CanonicalJobPosting } from "@job-market-analyzer/types/canonical-job";
import { getDayOfYear } from "./dateHelpers.js";
const today = getDayOfYear();
export async function upsertMerge(
  ddb: DynamoDBClient,
  table: string,
  p: CanonicalJobPosting
) {
  const base = {
    PK: `JOB#${p.postingHash}`,
    SK: "POSTING#v1",
    company: p.company,
    title: p.title,
    location: p.location,
    postedDate: p.postedDate,
    description: p.description,
    descriptionSig: p.descriptionSig,
    provenance: { termsUrl: p.termsUrl, robotsOk: p.robotsOk },
    source: p.source,
    originalUrl: p.originalUrl,
    fetchedAt: p.fetchedAt,
    fetchedDayOfYear: today,
    sources: [
      { source: p.source, originalUrl: p.originalUrl, fetchedAt: p.fetchedAt },
    ],
  };

  try {
    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: marshall(base, { removeUndefinedValues: true }),
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
    return "inserted";
  } catch {
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    const updates: string[] = [];

    // Basic fields
    const fields = ["company", "title", "postedDate"];
    for (const f of fields) {
      const v = (base as any)[f];
      if (v) {
        names[`#${f}`] = f;
        values[`:${f}`] = v;
        updates.push(`#${f} = if_not_exists(#${f}, :${f})`);
      }
    }

    // Location
    names["#location"] = "location";
    values[":location"] = base.location;
    updates.push(`#location = if_not_exists(#location, :location)`);

    // Description
    if (p.description) {
      names["#description"] = "description";
      names["#descriptionSig"] = "descriptionSig";
      values[":newDesc"] = p.description;
      values[":newSig"] = p.descriptionSig;
      updates.push(`#description = :newDesc`);
      updates.push(`#descriptionSig = :newSig`);
    }

    // sources
    names["#sources"] = "sources";
    values[":emptyList"] = [];

    values[":appendList"] = [
      {
        source: p.source,
        originalUrl: p.originalUrl,
        fetchedAt: p.fetchedAt,
      },
    ];
    updates.push(
      `#sources = list_append(if_not_exists(#sources, :emptyList), :appendList)`
    );

    await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: marshall({ PK: `JOB#${p.postingHash}`, SK: "POSTING#v1" }),
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, {
          removeUndefinedValues: true,
        }),
      })
    );

    return "updated";
  }
}
