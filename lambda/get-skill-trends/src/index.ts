import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TRENDS_TABLE = process.env.TRENDS_TABLE || "skill-trends";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/**
 * Lambda handler for querying skill trends
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Request received:", JSON.stringify(event, null, 2));

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const path = event.path;
  const params = event.queryStringParameters || {};

  try {
    // Route to different query handlers based on path
    if (path.includes("/trends/skill/")) {
      // Get specific skill: /trends/skill/{skillName}
      const skillName = path.split("/").pop();
      return await getSkillTrends(skillName || "");
    } else if (path.includes("/trends/region")) {
      // Get top skills by region: /trends/region?region=us&limit=10
      return await getTopSkillsByRegion(
        params.region || "us",
        parseInt(params.limit || "10")
      );
    } else if (path.includes("/trends/seniority")) {
      // Get top skills by seniority: /trends/seniority?level=senior&limit=10
      return await getTopSkillsBySeniority(
        params.level || "senior",
        parseInt(params.limit || "10")
      );
    } else if (path.includes("/trends/technology")) {
      // Get top technologies: /trends/technology?limit=20
      return await getTopTechnologies(parseInt(params.limit || "20"));
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid endpoint" }),
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

/**
 * Get all trend data for a specific skill
 */
async function getSkillTrends(
  skillName: string
): Promise<APIGatewayProxyResult> {
  const command = new QueryCommand({
    TableName: TRENDS_TABLE,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `skill#${skillName.toLowerCase()}`,
    },
  });

  const response = await docClient.send(command);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      skill: skillName,
      data: response.Items || [],
    }),
  };
}

/**
 * Get top skills by region using GSI
 */
async function getTopSkillsByRegion(
  region: string,
  limit: number
): Promise<APIGatewayProxyResult> {
  const command = new QueryCommand({
    TableName: TRENDS_TABLE,
    IndexName: "region-count-index",
    KeyConditionExpression: "region = :region",
    ExpressionAttributeValues: {
      ":region": region.toLowerCase(),
    },
    ScanIndexForward: false, // Descending order by count
    Limit: limit,
  });

  const response = await docClient.send(command);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      region,
      count: response.Items?.length || 0,
      data: response.Items || [],
    }),
  };
}

/**
 * Get top skills by seniority level using GSI
 */
async function getTopSkillsBySeniority(
  level: string,
  limit: number
): Promise<APIGatewayProxyResult> {
  const command = new QueryCommand({
    TableName: TRENDS_TABLE,
    IndexName: "seniority_level-count-index",
    KeyConditionExpression: "seniority_level = :level",
    ExpressionAttributeValues: {
      ":level": level.toLowerCase(),
    },
    ScanIndexForward: false,
    Limit: limit,
  });

  const response = await docClient.send(command);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      seniority_level: level,
      count: response.Items?.length || 0,
      data: response.Items || [],
    }),
  };
}

/**
 * Get top technologies using GSI
 */
async function getTopTechnologies(
  limit: number
): Promise<APIGatewayProxyResult> {
  const command = new QueryCommand({
    TableName: TRENDS_TABLE,
    IndexName: "skill_type-count-index",
    KeyConditionExpression: "skill_type = :type",
    ExpressionAttributeValues: {
      ":type": "technology",
    },
    ScanIndexForward: false,
    Limit: limit,
  });

  const response = await docClient.send(command);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      count: response.Items?.length || 0,
      data: response.Items || [],
    }),
  };
}
