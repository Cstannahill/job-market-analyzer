import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

/**
 * User Login Handler
 *
 * Architectural Purpose:
 * - Authenticates users via Cognito USER_PASSWORD_AUTH flow
 * - Returns JWT tokens (IdToken, AccessToken, RefreshToken)
 * - Updates lastLoginAt timestamp for analytics
 *
 * Security Model:
 * - Cognito handles credential verification
 * - Returns short-lived access tokens (configurable in Cognito)
 * - Refresh tokens enable seamless re-authentication
 *
 * Token Strategy:
 * - IdToken: Contains user claims (email, sub, name) - use for user identity
 * - AccessToken: For authorizing API Gateway requests
 * - RefreshToken: For obtaining new tokens without re-login
 *
 * Design Decision:
 * - Update lastLoginAt asynchronously (fire-and-forget pattern)
 * - Don't block login response on DynamoDB write
 * - Eventual consistency acceptable for analytics data
 */

const cognitoClient = new CognitoIdentityProviderClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const TABLE_NAME = process.env.USER_PROFILES_TABLE || "UserProfiles";

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface ErrorResponse {
  error: string;
  message: string;
}

// Update last login timestamp (non-blocking)
const updateLastLogin = async (userId: string): Promise<void> => {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId },
        UpdateExpression:
          "SET lastLoginAt = :timestamp, updatedAt = :timestamp",
        ExpressionAttributeValues: {
          ":timestamp": new Date().toISOString(),
        },
      })
    );
    console.log("Updated lastLoginAt for user:", userId);
  } catch (error) {
    // Log but don't fail login if timestamp update fails
    console.error("Failed to update lastLoginAt:", error);
  }
};

// Extract sub (userId) from IdToken without verification
// Note: This is safe because Cognito issued the token
const extractUserSub = (idToken: string): string | null => {
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.sub || null;
  } catch {
    return null;
  }
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Login request received");

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "BadRequest",
          message: "Request body is required",
        } as ErrorResponse),
      };
    }

    const body: LoginRequest = JSON.parse(event.body);

    if (!body.email || !body.password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "ValidationError",
          message: "Email and password are required",
        } as ErrorResponse),
      };
    }

    // Initiate authentication with Cognito
    const authParams: InitiateAuthCommandInput = {
      ClientId: CLIENT_ID,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
    };

    const authResponse = await cognitoClient.send(
      new InitiateAuthCommand(authParams)
    );

    if (!authResponse.AuthenticationResult) {
      throw new Error("Authentication failed - no tokens returned");
    }

    const { IdToken, AccessToken, RefreshToken, ExpiresIn, TokenType } =
      authResponse.AuthenticationResult;

    console.log("Authentication successful");

    // Update lastLoginAt timestamp asynchronously
    if (IdToken) {
      const userId = extractUserSub(IdToken);
      if (userId) {
        // Fire and forget - don't await
        updateLastLogin(userId).catch((err) =>
          console.error("Background lastLoginAt update failed:", err)
        );
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        idToken: IdToken!,
        accessToken: AccessToken!,
        refreshToken: RefreshToken!,
        expiresIn: ExpiresIn!,
        tokenType: TokenType || "Bearer",
      } as LoginResponse),
    };
  } catch (error: any) {
    console.error("Login error:", error);

    // Map Cognito errors to user-friendly messages
    let statusCode = 401;
    let errorMessage = "Invalid email or password";

    if (error.name === "NotAuthorizedException") {
      errorMessage = "Invalid email or password";
    } else if (error.name === "UserNotConfirmedException") {
      statusCode = 403;
      errorMessage =
        "Email not verified. Please check your email for verification code.";
    } else if (error.name === "UserNotFoundException") {
      errorMessage = "Invalid email or password"; // Don't reveal user existence
    } else if (error.name === "TooManyRequestsException") {
      statusCode = 429;
      errorMessage = "Too many login attempts. Please try again later.";
    } else if (error.name !== "NotAuthorizedException") {
      statusCode = 500;
      errorMessage = "Login failed. Please try again.";
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error.name || "AuthenticationError",
        message: errorMessage,
      } as ErrorResponse),
    };
  }
};
