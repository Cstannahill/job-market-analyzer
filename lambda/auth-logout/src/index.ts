import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

/**
 * User Logout Handler
 *
 * Architectural Purpose:
 * - Invalidates all tokens for a user across all devices
 * - Provides clean session termination
 * - Enables security-critical operations (password change, suspicious activity)
 *
 * Token Lifecycle Management:
 * - GlobalSignOut invalidates ALL tokens for the user
 * - Access tokens become invalid immediately
 * - Refresh tokens can no longer generate new access tokens
 * - User must re-authenticate to obtain new tokens
 *
 * Design Trade-offs:
 * - GlobalSignOut affects all devices (single sign-out vs. device-specific)
 * - Alternative: Track tokens in DynamoDB for granular control
 * - Current approach: Simplicity over fine-grained control
 *
 * Frontend Responsibility:
 * - Lambda invalidates server-side tokens
 * - Frontend MUST clear local storage/cookies
 * - Defense in depth: Server + client token removal
 */

const client = new CognitoIdentityProviderClient({});

interface ErrorResponse {
  error: string;
  message: string;
}

interface SuccessResponse {
  message: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Logout request received");

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
    // Extract access token from Authorization header
    const authHeader =
      event.headers.authorization || event.headers.Authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: "Unauthorized",
          message: "Access token required",
        } as ErrorResponse),
      };
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Execute global sign out
    // This invalidates all tokens for the user across all devices
    await client.send(
      new GlobalSignOutCommand({
        AccessToken: accessToken,
      })
    );

    console.log("User signed out successfully");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Logged out successfully",
      } as SuccessResponse),
    };
  } catch (error: any) {
    console.error("Logout error:", error);

    // Handle specific Cognito errors
    let statusCode = 500;
    let errorMessage = "Logout failed";

    if (error.name === "NotAuthorizedException") {
      statusCode = 401;
      errorMessage = "Invalid or expired access token";
    } else if (error.name === "TooManyRequestsException") {
      statusCode = 429;
      errorMessage = "Too many requests. Please try again later.";
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error.name || "LogoutError",
        message: errorMessage,
      } as ErrorResponse),
    };
  }
};
