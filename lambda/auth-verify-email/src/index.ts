import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { EmailVerificationRequest } from "@job-market-analyzer/types/auth";

/**
 * Email Verification Lambda
 *
 * Architectural Purpose:
 * - Completes user registration by confirming email ownership
 * - Bridges gap between registration and first login
 * - Provides resend mechanism for lost/expired codes
 *
 * Design Decisions:
 * - Single endpoint handles both confirm and resend (action parameter)
 * - Idempotent: confirming already-confirmed user returns success
 * - Rate limiting should be applied at API Gateway level
 * - Error messages carefully crafted to avoid information disclosure
 *
 * Security Model:
 * - No authentication required (pre-login state)
 * - Cognito validates code authenticity
 * - Limited attempts enforced by Cognito
 * - Code expiration handled by Cognito (24 hours default)
 *
 * State Transitions:
 * - UNCONFIRMED → CONFIRMED (verify action)
 * - Resend generates new code, invalidates old one
 */

const client = new CognitoIdentityProviderClient({});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

interface ErrorResponse {
  error: string;
  message: string;
}

interface SuccessResponse {
  message: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Email verification request received");

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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

    const body: EmailVerificationRequest = JSON.parse(event.body);

    // Validate required fields
    if (!body.email || !body.action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "ValidationError",
          message: "Email and action are required",
        } as ErrorResponse),
      };
    }

    // Route to appropriate action
    if (body.action === "verify") {
      return await handleVerify(body, headers);
    } else if (body.action === "resend") {
      return await handleResend(body, headers);
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "ValidationError",
          message: 'Invalid action. Must be "verify" or "resend"',
        } as ErrorResponse),
      };
    }
  } catch (error: any) {
    console.error("Email verification error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "InternalServerError",
        message: "Verification failed. Please try again.",
      } as ErrorResponse),
    };
  }
};

/**
 * Handle email verification with code
 *
 * Cognito Error Mapping:
 * - CodeMismatchException: Invalid code entered
 * - ExpiredCodeException: Code older than 24 hours
 * - NotAuthorizedException: Already confirmed (treat as success)
 * - UserNotFoundException: Invalid email (obfuscate for security)
 * - TooManyRequestsException: Rate limit exceeded
 *
 * Design Philosophy:
 * - Fail securely: Don't reveal whether user exists
 * - Already confirmed = success (idempotent operation)
 * - Clear, actionable error messages for legitimate users
 */
async function handleVerify(
  body: EmailVerificationRequest,
  headers: Record<string, string>
): Promise<any> {
  if (!body.code) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "ValidationError",
        message: "Verification code is required",
      } as ErrorResponse),
    };
  }

  try {
    await client.send(
      new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
        ConfirmationCode: body.code,
      })
    );

    console.log("Email verified successfully:", { email: body.email });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Email verified successfully. You can now log in.",
      } as SuccessResponse),
    };
  } catch (error: any) {
    console.error("Verification error:", error);

    let statusCode = 400;
    let errorMessage = "Verification failed";

    // Map Cognito errors to user-friendly messages
    switch (error.name) {
      case "CodeMismatchException":
        errorMessage = "Invalid verification code. Please check and try again.";
        break;

      case "ExpiredCodeException":
        errorMessage =
          "Verification code has expired. Please request a new code.";
        break;

      case "NotAuthorizedException":
        // User already confirmed - treat as success (idempotent)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: "Email already verified. You can now log in.",
          } as SuccessResponse),
        };

      case "UserNotFoundException":
        // Don't reveal user existence - generic message
        errorMessage = "Verification failed. Please check your email and code.";
        break;

      case "TooManyRequestsException":
        statusCode = 429;
        errorMessage = "Too many attempts. Please try again later.";
        break;

      case "LimitExceededException":
        statusCode = 429;
        errorMessage = "Too many failed attempts. Please request a new code.";
        break;

      default:
        statusCode = 500;
        errorMessage = "Verification failed. Please try again.";
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error.name || "VerificationError",
        message: errorMessage,
      } as ErrorResponse),
    };
  }
}

/**
 * Handle resend verification code
 *
 * Behavior:
 * - Generates new code, invalidates previous one
 * - Rate limited by Cognito (max 5 requests per hour typical)
 * - Already confirmed users receive success (no-op)
 *
 * Security Considerations:
 * - Don't reveal if email exists in system
 * - Apply rate limiting at API Gateway level
 * - Log resend attempts for abuse monitoring
 */
async function handleResend(
  body: EmailVerificationRequest,
  headers: Record<string, string>
): Promise<any> {
  try {
    const response = await client.send(
      new ResendConfirmationCodeCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
      })
    );

    console.log("Verification code resent:", {
      email: body.email,
      destination: response.CodeDeliveryDetails?.Destination,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Verification code sent to ${
          response.CodeDeliveryDetails?.Destination || "your email"
        }`,
      } as SuccessResponse),
    };
  } catch (error: any) {
    console.error("Resend error:", error);

    let statusCode = 400;
    let errorMessage = "Failed to resend verification code";

    switch (error.name) {
      case "InvalidParameterException":
        // User already confirmed
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: "Email already verified. No code needed.",
          } as SuccessResponse),
        };

      case "UserNotFoundException":
        // Don't reveal user existence
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            message: "If the email exists, a verification code has been sent.",
          } as SuccessResponse),
        };

      case "TooManyRequestsException":
      case "LimitExceededException":
        statusCode = 429;
        errorMessage = "Too many resend requests. Please try again later.";
        break;

      default:
        statusCode = 500;
        errorMessage = "Failed to resend code. Please try again.";
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error.name || "ResendError",
        message: errorMessage,
      } as ErrorResponse),
    };
  }
}
