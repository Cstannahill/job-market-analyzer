import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmForgotPasswordCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { ConfirmForgotPasswordRequest } from "@job-market-analyzer/types";

const client = new CognitoIdentityProviderClient({});
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

interface ErrorResponse {
  error: string;
  message: string;
}

interface ConfirmForgotPasswordResponse {
  message: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Confirm forgot password request received:", {
    path: event.requestContext.http.path,
    method: event.requestContext.http.method,
  });

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

    const body: ConfirmForgotPasswordRequest = JSON.parse(event.body);

    if (!body.email || !body.code || !body.newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "ValidationError",
          message: "Email, code, and newPassword are required",
        } as ErrorResponse),
      };
    }

    const params: ConfirmForgotPasswordCommandInput = {
      ClientId: CLIENT_ID,
      Username: body.email,
      ConfirmationCode: body.code,
      Password: body.newPassword,
    };

    await client.send(new ConfirmForgotPasswordCommand(params));

    console.log("Password reset confirmed for:", body.email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Password reset successfully. You can now sign in.",
      } as ConfirmForgotPasswordResponse),
    };
  } catch (error: any) {
    console.error("ConfirmForgotPassword error:", error);

    let statusCode = 400;
    let msg = "Password reset failed. Please check the code and try again.";

    if (error.name === "CodeMismatchException") {
      msg = "Invalid verification code.";
    } else if (error.name === "ExpiredCodeException") {
      msg = "Verification code has expired. Please request a new one.";
    } else if (error.name === "InvalidPasswordException") {
      msg = "Password does not meet requirements.";
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error.name || "ConfirmForgotPasswordError",
        message: msg,
      } as ErrorResponse),
    };
  }
};
