import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { InsightsItem } from "./types.js";

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

export const insertResume = async (resumeItem: any) => {
  await dynamo.send(
    new PutItemCommand({
      TableName: RESUME_TABLE,
      Item: marshall(resumeItem, { removeUndefinedValues: true }),
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
