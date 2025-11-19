import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type {
  PostConfirmationTriggerEvent,
  PostConfirmationTriggerHandler,
} from "aws-lambda";
import type { UserProfile } from "@job-market-analyzer/types/auth";

/**
 * Post-Confirmation Trigger
 *
 * Architectural Purpose:
 * - Automatically creates DynamoDB user profile when Cognito user is confirmed
 * - Maintains data consistency between authentication and application layers
 * - Executes synchronously in Cognito flow, ensuring profile exists before first login
 *
 * Design Decisions:
 * - Idempotent: Safe to retry if DynamoDB write fails
 * - No email sending: Keeps function focused on data persistence
 * - Minimal error handling: Cognito requires success return or user confirmation fails
 */

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
    name: name || email.split("@")[0], // Fallback to email prefix
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
        // Prevent overwriting if profile already exists (idempotency)
        ConditionExpression: "attribute_not_exists(userId)",
      })
    );

    console.log("User profile created successfully:", { userId: sub });
  } catch (error: any) {
    // If condition fails, profile already exists - this is acceptable
    if (error.name === "ConditionalCheckFailedException") {
      console.log("User profile already exists:", { userId: sub });
    } else {
      console.error("Failed to create user profile:", error);
      throw error; // Propagate error to fail user confirmation
    }
  }

  // Cognito requires returning the event object
  return event;
};
