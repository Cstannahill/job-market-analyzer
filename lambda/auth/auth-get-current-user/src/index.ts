import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayEventRequestContextV2WithAuthorizer,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyEventV2,
} from "aws-lambda";
import type { UserProfile } from "@job-market-analyzer/types/auth";

/**
 * Get Current User Handler
 *
 * Architectural Purpose:
 * - Retrieves user profile data for authenticated requests
 * - Demonstrates separation between authentication (Cognito) and authorization (API Gateway)
 * - Serves as reference implementation for protected endpoints
 *
 * Security Model:
 * - API Gateway validates JWT before Lambda invocation
 * - Lambda receives pre-validated user context in event.requestContext.authorizer
 * - No token verification needed in Lambda (defense in depth via Gateway)
 *
 * Design Pattern: Read-Through Cache Candidate
 * - High read frequency endpoint
 * - Consider CloudFront + API Gateway caching in production
 * - DynamoDB provides millisecond latency as-is
 *
 * Error Handling Philosophy:
 * - 401: Authentication failed (handled by API Gateway)
 * - 404: User profile not found (data inconsistency - should never happen)
 * - 500: Infrastructure failure (DynamoDB unavailable)
 */

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.USER_PROFILES_TABLE || "UserProfiles";

interface JWTAuthorizerContext {
  jwt: {
    claims: {
      sub: string;
      [key: string]: any;
    };
  };
}

interface ErrorResponse {
  error: string;
  message: string;
}

type AuthenticatedEvent = Omit<APIGatewayProxyEventV2, "requestContext"> & {
  requestContext: APIGatewayEventRequestContextV2WithAuthorizer<JWTAuthorizerContext>;
};

export const handler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResultV2> => {
  console.log("Get current user request received");

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };

  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Extract userId from Cognito authorizer context
    // API Gateway JWT authorizer populates this from the token's 'sub' claim
    const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string;

    if (!userId) {
      console.error("No userId in authorizer context");
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: "Unauthorized",
          message: "Authentication required",
        } as ErrorResponse),
      };
    }

    console.log("Fetching profile for user:", userId);

    // Retrieve user profile from DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId },
      })
    );

    if (!result.Item) {
      // This indicates data inconsistency - Cognito user exists but no profile
      console.error("User profile not found:", userId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: "NotFound",
          message: "User profile not found",
        } as ErrorResponse),
      };
    }

    const userProfile = result.Item as UserProfile;

    console.log("User profile retrieved successfully");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(userProfile),
    };
  } catch (error: any) {
    console.error("Error fetching user profile:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "InternalServerError",
        message: "Failed to retrieve user profile",
      } as ErrorResponse),
    };
  }
};
