import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  SignUpCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { RegisterRequest } from "@job-market-analyzer/types/auth";

/**
 * User Registration Handler
 *
 * Architectural Purpose:
 * - Provides HTTP interface for Cognito SignUp operation
 * - Input validation layer before Cognito interaction
 * - Standardized error handling and response formatting
 *
 * Security Considerations:
 * - No password complexity checks here (Cognito enforces policy)
 * - Email validation at API layer prevents malformed requests
 * - CORS headers enable secure cross-origin requests
 *
 * Flow:
 * 1. Validate request body structure
 * 2. Call Cognito SignUp
 * 3. User receives verification email
 * 4. Post-confirmation trigger creates DynamoDB profile
 */

const client = new CognitoIdentityProviderClient({});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

interface ErrorResponse {
  error: string;
  message: string;
}

interface SuccessResponse {
  message: string;
  userSub: string;
  codeDeliveryDetails?: {
    destination: string;
    deliveryMedium: string;
  };
}

// Simple email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Register request received:", {
    path: event.requestContext.http.path,
    method: event.requestContext.http.method,
  });

  // CORS headers for browser requests
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // Configure with your domain in production
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  // Handle OPTIONS preflight
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    // Parse and validate request body
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

    const body: RegisterRequest = JSON.parse(event.body);

    // Validate required fields
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

    // Validate email format
    if (!isValidEmail(body.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "ValidationError",
          message: "Invalid email format",
        } as ErrorResponse),
      };
    }

    // Prepare Cognito SignUp parameters
    const signUpParams: SignUpCommandInput = {
      ClientId: CLIENT_ID,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        {
          Name: "email",
          Value: body.email,
        },
        ...(body.name
          ? [
              {
                Name: "name",
                Value: body.name,
              },
            ]
          : []),
      ],
    };

    // Execute SignUp
    const response = await client.send(new SignUpCommand(signUpParams));

    console.log("User registered successfully:", {
      userSub: response.UserSub,
      confirmed: response.UserConfirmed,
    });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message:
          "User registered successfully. Please check your email for verification code.",
        userSub: response.UserSub!,
        codeDeliveryDetails: response.CodeDeliveryDetails
          ? {
              destination: response.CodeDeliveryDetails.Destination!,
              deliveryMedium: response.CodeDeliveryDetails.DeliveryMedium!,
            }
          : undefined,
      } as SuccessResponse),
    };
  } catch (error: any) {
    console.error("Registration error:", error);

    // Map Cognito errors to user-friendly messages
    const statusCode = error.name === "UsernameExistsException" ? 409 : 400;

    const errorMessage =
      error.name === "UsernameExistsException"
        ? "User with this email already exists"
        : error.name === "InvalidPasswordException"
        ? "Password does not meet requirements"
        : error.name === "InvalidParameterException"
        ? error.message
        : "Registration failed. Please try again.";

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error.name || "RegistrationError",
        message: errorMessage,
      } as ErrorResponse),
    };
  }
};
