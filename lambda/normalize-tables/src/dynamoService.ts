import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoJobPosting } from "./types.js";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const SOURCE_TABLE = process.env.DYNAMO_SOURCE_TABLE ?? "job-postings-enhanced";

export type FetchPostingsOptions = {
  pageSize?: number;
  maxPages?: number;
};

function isAlreadyNormalized(posting: DynamoJobPosting): boolean {
  const flag = posting.normalized;
  if (flag === true) return true;
  if (typeof flag === "string") {
    const normalized = flag.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
}

export async function fetchPendingJobPostings(
  options: FetchPostingsOptions = {}
): Promise<DynamoJobPosting[]> {
  const postings: DynamoJobPosting[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  const pageSize = options.pageSize ?? 200;
  const maxPages = options.maxPages ?? Infinity;
  let pageCount = 0;

  do {
    const response = await docClient.send(
      new ScanCommand({
        TableName: SOURCE_TABLE,
        Limit: pageSize,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    const items = (response.Items ?? []) as DynamoJobPosting[];
    for (const item of items) {
      if (!isAlreadyNormalized(item)) {
        postings.push(item);
      }
    }

    exclusiveStartKey = response.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
    pageCount += 1;
  } while (exclusiveStartKey && pageCount < maxPages);

  return postings;
}

export type DynamoKey = {
  name: string;
  value: string;
};

export async function markPostingAsNormalized(key: DynamoKey): Promise<void> {
  if (!key.value) return;
  await docClient.send(
    new UpdateCommand({
      TableName: SOURCE_TABLE,
      Key: { [key.name]: key.value },
      UpdateExpression: "SET normalized = :trueVal, normalized_at = :timestamp",
      ExpressionAttributeValues: {
        ":trueVal": true,
        ":timestamp": new Date().toISOString(),
      },
    })
  );
}
