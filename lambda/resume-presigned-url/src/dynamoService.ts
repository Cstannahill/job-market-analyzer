import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const RESUME_TABLE = process.env.RESUME_TABLE || "resumes-base";
const REGION = process.env.AWS_REGION_NAME || "us-east-1";
const dynamo = new DynamoDBClient({ region: REGION });

export interface ResumeItem {
  PK: string;
  SK: string;
  status: "pending" | "processed" | "failed";
  originalFileName: string;
  contentType: string;
  s3Key: string;
  uploadInitiatedAt?: string;
  ttl: number;
}

export const insertResume = async (resumeItem: ResumeItem) => {
  await dynamo.send(
    new PutItemCommand({
      TableName: RESUME_TABLE,
      Item: marshall(resumeItem, { removeUndefinedValues: true }),
    })
  );
};
