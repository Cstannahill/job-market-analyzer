import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { processFile } from "./fileProcessor.js";

const JOBS_TABLE = process.env.JOBS_TABLE!;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
  },
});

function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj
      .filter((v) => v !== undefined)
      .map((v) => stripUndefined(v)) as unknown as T;
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v as any);
    }
    return out;
  }
  return obj;
}

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { jobId, s3Key, userId } = JSON.parse(record.body) as {
      jobId: string;
      s3Key: string;
      userId: string;
    };

    const pk = `JOB#${jobId}`;

    await ddb.send(
      new UpdateCommand({
        TableName: JOBS_TABLE,
        Key: { PK: pk, SK: pk },
        UpdateExpression: "SET #status = :s, #updatedAt = :t",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":s": "processing",
          ":t": new Date().toISOString(),
        },
      })
    );

    try {
      const result = await processFile(s3Key);
      const clean = stripUndefined(result);

      await ddb.send(
        new UpdateCommand({
          TableName: JOBS_TABLE,
          Key: { PK: pk, SK: pk },
          UpdateExpression: "SET #status = :s, #updatedAt = :t, #result = :r",
          ExpressionAttributeNames: {
            "#status": "status",
            "#updatedAt": "updatedAt",
            "#result": "result",
          },
          ExpressionAttributeValues: {
            ":s": "succeeded",
            ":t": new Date().toISOString(),
            ":r": clean,
          },
        })
      );
    } catch (e) {
      const message =
        (e instanceof Error ? e.message : String(e)) || "unknown error";

      await ddb.send(
        new UpdateCommand({
          TableName: JOBS_TABLE,
          Key: { PK: pk, SK: pk },
          UpdateExpression: "SET #status = :s, #updatedAt = :t, #err = :e",
          ExpressionAttributeNames: {
            "#status": "status",
            "#updatedAt": "updatedAt",
            "#err": "error",
          },
          ExpressionAttributeValues: {
            ":s": "failed",
            ":t": new Date().toISOString(),
            ":e": message,
          },
        })
      );

      throw e;
    }
  }
};
