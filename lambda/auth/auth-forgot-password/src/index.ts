import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
  ForgotPasswordCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { PasswordResetInitiateRequest } from "@job-market-analyzer/types/auth";
const client = new CognitoIdentityProviderClient({});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
interface ErrorResponse {
  error: string;
  message: string;
}

interface ForgotPasswordResponse {
  message: string;
  codeDeliveryDetails?: {
    destination: string;
    deliveryMedium: string;
  };
}
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Forgot password request received:", {
    path: event.requestContext.http.path,
    method: event.requestContext.http.method,
  });

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // tighten in prod
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  // OPTIONS preflight
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

    const body: PasswordResetInitiateRequest = JSON.parse(event.body);

    if (!body.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "ValidationError",
          message: "Email is required",
        } as ErrorResponse),
      };
    }

    const params: ForgotPasswordCommandInput = {
      ClientId: CLIENT_ID,
      Username: body.email,
    };

    const resp = await client.send(new ForgotPasswordCommand(params));

    console.log("ForgotPassword initiated:", {
      destination: resp.CodeDeliveryDetails?.Destination,
      medium: resp.CodeDeliveryDetails?.DeliveryMedium,
    });

    // Important: don't leak whether the user exists
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message:
          "If an account exists for this email, a verification code has been sent.",
        codeDeliveryDetails: resp.CodeDeliveryDetails
          ? {
              destination: resp.CodeDeliveryDetails.Destination ?? "",
              deliveryMedium: resp.CodeDeliveryDetails.DeliveryMedium ?? "",
            }
          : undefined,
      } as ForgotPasswordResponse),
    };
  } catch (error: any) {
    console.error("ForgotPassword error:", error);

    // Mask UserNotFound to avoid user enumeration
    const isUserNotFound = error.name === "UserNotFoundException";

    return {
      statusCode: 200, // still 200 to hide existence
      headers,
      body: JSON.stringify({
        message:
          "If an account exists for this email, a verification code has been sent.",
        error: isUserNotFound ? undefined : error.name,
      }),
    };
  }
};
