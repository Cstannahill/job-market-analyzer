import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { handlePreflight } from "./preflight.js";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "Resumes";

interface BaseResume {
PK: string; // userId
SK: string; // resumeId
contactInfo: Record<string, any>;
contentType: string;
education: string[];
experience: string[];
originalFileName: string;
s3Key: string;
skills: string[];
status: "pending" | "processed" | "failed";
ttl?: number;
updatedAt?: string;
uploadedAt: string;
uploadInitiatedAt?: string;
}
interface ResumeInsights {
    PK: string; // resumeId
    SK: string; // insights
    generatedAt: string;
    generatedBy: string;
    insights: Record<string, any>;
    resumeId: string;
}




/**
 * Lambda handler for API Gateway
 * Returns all job postings from DynamoDB
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const { statusCode, headers, body } = await handlePreflight(event);
    let userId: string; 
    
    try { 
    const parsed = JSON.parse(body || "{}");
        userId = parsed.userId;
        if (!userId) throw new Error("Missing userId in body");
    }   
    catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid or missing userId" }),
    };
    }
    
    const PK = `USER#${userId}`;
    let response: any = null;

    const cmdInput: any = { TableName: TABLE_NAME };


    response = await docClient.send(new QueryCommand(cmdInput));
    const items = (response.Items || []) as JobPosting[];
    jobPostings.push(...items);

    const rawLastKey = (response as any).LastEvaluatedKey;
    let encodedLastKey: string | undefined = undefined;
    if (rawLastKey) {
      try {
        const json = JSON.stringify(rawLastKey);
        encodedLastKey = Buffer.from(json, "utf8").toString("base64");
      } catch (err) {
        console.warn("Failed to encode LastEvaluatedKey", err);
      }
    }

    // Sort by date (newest first)
    jobPostings.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    console.log(`Successfully retrieved ${jobPostings.length} job postings`);

    // If no pagination params were provided, and requestedLimit is undefined
    // keep legacy behavior and scan the entire table (careful on large tables).
    if (typeof requestedLimit !== "number" && !lastKeyParam) {
      // continue scanning to collect all pages
      let ExclusiveStart = (response as any).LastEvaluatedKey;
      while (ExclusiveStart) {
        const next = await docClient.send(
          new ScanCommand({ TableName, ExclusiveStartKey: ExclusiveStart })
        );
        const nextItems = (next.Items || []) as JobPosting[];
        jobPostings.push(...nextItems);
        ExclusiveStart = (next as any).LastEvaluatedKey;
      }

      // Sort by date (newest first)
      jobPostings.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: jobPostings.length,
          data: jobPostings,
        }),
      };
    }

    // Paginated response: return page + lastKey token (if any)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: jobPostings.length,
        data: jobPostings,
        lastKey: encodedLastKey ?? null,
      }),
    };
  } catch (error) {
    console.error("Error fetching job postings:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch job postings",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
