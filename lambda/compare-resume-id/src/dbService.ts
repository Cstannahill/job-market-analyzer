import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { InsightsItem } from "./types.js";
import type {
  ResumeBaseItem,
  ResumeItem,
  ResumeWithInsights,
} from "./types.js";
import { v4 as uuidv4 } from "uuid";
import { removeUndefinedDeep } from "./sanitizers.js";

const RESUME_TABLE = process.env.RESUME_TABLE || "resumes-base";
const INSIGHTS_TABLE = process.env.INSIGHTS_TABLE || "resume-insights";
const QUERY_TABLE = process.env.QUERY_TABLE || "resumes-with-insights-query";
const dynamo = new DynamoDBClient({ region: "us-east-1" });

export async function updateInsights(insightsItem: InsightsItem) {
  const item = {
    PK: `${insightsItem.resumeId}`,
    SK: insightsItem.insightId,
    resumeId: insightsItem.resumeId.split("#")[1],
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
  // Always include status, since we know it must be "processed" here
  const fields: Record<string, any> = {
    contactInfo: resumeItem.contactInfo,
    skills: resumeItem.skills,
    education: resumeItem.education,
    experience: resumeItem.experience,
    status: "processed", //hardcoded here
    uploadedAt: resumeItem.uploadedAt,
    updatedAt: resumeItem.updatedAt,
  };

  // Filter out undefined values
  const definedFields = Object.fromEntries(
    Object.entries(fields).filter(([_, v]) => v !== undefined)
  );

  // Build dynamic UpdateExpression
  const expressionParts: string[] = [];
  const attributeNames: Record<string, string> = {};
  const attributeValues: Record<string, any> = {};

  for (const [key, value] of Object.entries(definedFields)) {
    const nameKey = `#${key}`;
    const valueKey = `:${key}`;
    expressionParts.push(`${nameKey} = ${valueKey}`);
    attributeNames[nameKey] = key;
    attributeValues[valueKey] = value;
  }

  const updateExpression = `SET ${expressionParts.join(", ")}`;

  await dynamo.send(
    new UpdateItemCommand({
      TableName: RESUME_TABLE,
      Key: marshall(
        { PK: resumeItem.PK, SK: resumeItem.SK },
        { removeUndefinedValues: true }
      ),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: marshall(attributeValues, {
        removeUndefinedValues: true,
      }),
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );

  return { ...resumeItem, status: "processed" };
};

export const insertResumeWithInsights = async (
  resumeItem: ResumeItem,
  insightsItem: InsightsItem
) => {
  const resumeWithInsights: ResumeWithInsights = {
    PK: resumeItem.PK,
    SK: resumeItem.SK,
    status: resumeItem.status,
    originalFileName: resumeItem.originalFileName,
    s3Key: resumeItem.s3Key,
    contentType: resumeItem.contentType,
    uploadInitiatedAt: resumeItem.uploadInitiatedAt,
    contactInfo: resumeItem.contactInfo,
    skills: resumeItem.skills,
    education: resumeItem.education,
    experience: resumeItem.experience,
    uploadedAt: resumeItem.uploadedAt,
    updatedAt: resumeItem.updatedAt,
    insightId: insightsItem.insightId,
    insightsText: insightsItem.insightsText,
    insightsMetadata: {
      generatedAt: insightsItem.generatedAt,
      generatedBy: insightsItem.generatedBy,
    },
    ttl: resumeItem.ttl,
  };
  await dynamo.send(
    new PutItemCommand({
      TableName: QUERY_TABLE,
      Item: marshall(removeUndefinedDeep(resumeWithInsights), {
        removeUndefinedValues: true,
      }),
    })
  );
  return resumeWithInsights;
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
