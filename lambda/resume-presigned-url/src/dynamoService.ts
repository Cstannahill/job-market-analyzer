import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { ResumeRecord } from "@job-market-analyzer/types/resume-record";

const RESUME_TABLE = process.env.RESUME_TABLE || "resumes-base";
const REGION = process.env.AWS_REGION_NAME || "us-east-1";
const dynamo = new DynamoDBClient({ region: REGION });

export type ResumeItem = Pick<
  ResumeRecord,
  | "PK"
  | "SK"
  | "status"
  | "originalFileName"
  | "contentType"
  | "uploadInitiatedAt"
> & {
  s3Key: string;
  ttl: number;
};

export const insertResume = async (resumeItem: ResumeItem) => {
  await dynamo.send(
    new PutItemCommand({
      TableName: RESUME_TABLE,
      Item: marshall(resumeItem, { removeUndefinedValues: true }),
    })
  );
};

export const countUserResumes = async (userId: string): Promise<number> => {
  const resp = await dynamo.send(
    new QueryCommand({
      TableName: RESUME_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": { S: `USER#${userId}` },
        ":skPrefix": { S: "RESUME#" },
      },
      Select: "COUNT",
      ConsistentRead: true,
    })
  );
  return resp.Count ?? 0;
};
