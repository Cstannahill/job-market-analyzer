import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { InsightsItem } from "./types.js";
import type { ResumeBaseItem } from "./types.js";

const RESUME_TABLE = process.env.RESUME_TABLE || "Resumes";
const INSIGHTS_TABLE = process.env.INSIGHTS_TABLE || "ResumeInsights";
const dynamo = new DynamoDBClient({ region: "us-east-1" });

export async function updateInsights(insightsItem: InsightsItem) {
  const item = {
    PK: `RESUME#${insightsItem.resumeId}`,
    SK: "INSIGHTS#LLM",
    resumeId: insightsItem.resumeId,
    insights: insightsItem.insightsText,
    generatedAt: insightsItem.generatedAt,
    generatedBy: insightsItem.generatedBy,
  };
  await dynamo.send(
    new PutItemCommand({
      TableName: INSIGHTS_TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  );
  return item;
}

export const updateResume = async (resumeItem: any) => {
  await dynamo.send(
    new UpdateItemCommand({
      TableName: RESUME_TABLE,
      Key: marshall({ PK: resumeItem.PK, SK: resumeItem.SK }),
      UpdateExpression:
        "SET #contactInfo = :contactInfo, #skills = :skills, #education = :education, #experience = :experience, #status = :status, #uploadedAt = :uploadedAt, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#contactInfo": "contactInfo",
        "#skills": "skills",
        "#education": "education",
        "#experience": "experience",
        "#status": "status",
        "#uploadedAt": "uploadedAt",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: marshall({
        ":contactInfo": resumeItem.contactInfo,
        ":skills": resumeItem.skills,
        ":education": resumeItem.education,
        ":experience": resumeItem.experience,
        ":status": resumeItem.status,
        ":uploadedAt": resumeItem.uploadedAt,
        ":updatedAt": resumeItem.updatedAt,
      }),
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );
};

export const getResumeById = async (resumeId: string) => {
  const params = {
    TableName: RESUME_TABLE,
    Key: marshall(
      {
        PK: `RESUME#${resumeId}`,
        SK: "META#INFO",
      },
      { removeUndefinedValues: true }
    ),
  };
  const { Item } = await dynamo.send(new GetItemCommand(params));
  if (!Item) {
    throw new Error("Resume not found");
  }
  return unmarshall(Item);
};

export const getResumeByS3Key = async (s3Key: string) => {
  const params = {
    TableName: RESUME_TABLE,
    IndexName: "s3KeyIndex", // <-- must match your GSI name
    KeyConditionExpression: "s3Key = :s3Key",
    ExpressionAttributeValues: {
      ":s3Key": s3Key,
    },
    Limit: 1,
  };

  const { Items } = await dynamo.send(new QueryCommand(params));
  if (!Items?.length) throw new Error("Resume not found");

  return Items[0] as ResumeBaseItem;
};
