import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type {
  PostConfirmationTriggerEvent,
  PostConfirmationTriggerHandler,
} from "aws-lambda";
import type { UserProfile } from "@job-market-analyzer/types/auth";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.USER_PROFILES_TABLE || "UserProfiles";

export const handler: PostConfirmationTriggerHandler = async (
  event: PostConfirmationTriggerEvent
) => {
  console.log("Post-confirmation trigger invoked:", {
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource,
  });

  const { sub, email, name } = event.request.userAttributes;

  if (!sub || !email) {
    console.error("Missing required attributes:", { sub, email });
    throw new Error("User attributes incomplete");
  }

  const now = new Date().toISOString();

  const userProfile: UserProfile = {
    userId: sub,
    email,
    name: name || email.split("@")[0],
    createdAt: now,
    updatedAt: now,
    preferences: {
      emailNotifications: true,
      theme: "light",
    },
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: userProfile,

        ConditionExpression: "attribute_not_exists(userId)",
      })
    );

    console.log("User profile created successfully:", { userId: sub });
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      console.log("User profile already exists:", { userId: sub });
    } else {
      console.error("Failed to create user profile:", error);
      throw error;
    }
  }

  return event;
};
