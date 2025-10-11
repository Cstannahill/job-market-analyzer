import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import axios from "axios";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || "builtwith-data";
const BUILTWITH_API_KEY = process.env.BUILTWITH_API_KEY || "";
const DELAY_MS = 500;

/**
 * Table Structure:
 * PK: company#<domain>
 * SK: tech#<category>#<date> | summary#<date>
 *
 * GSI1:
 * PK: technology#<techName>
 * SK: company#<domain>
 *
 * Example items:
 * - company#example.com | tech#analytics#2025-10 | { name, category, firstDetected, lastDetected }
 * - company#example.com | summary#2025-10 | { totalTech, categories, topTech }
 * - technology#react | company#example.com | { domain, since, category }
 */

interface BuiltWithTechnology {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  domain: string;
  technology: string;
  category: string;
  subcategory?: string;
  firstDetected: string;
  lastDetected: string;
  isCurrent: boolean;
  confidence: number;
  scrapedAt: string;
}

interface BuiltWithSummary {
  PK: string;
  SK: string;
  domain: string;
  totalTechnologies: number;
  categories: Record<string, number>;
  topTechnologies: Array<{ name: string; category: string }>;
  primaryLanguage?: string;
  frameworkStack: string[];
  hostingProvider?: string;
  cdnProvider?: string;
  analyticsTools: string[];
  advertisingTools: string[];
  ecommerceTools: string[];
  cmsProvider?: string;
  scrapedAt: string;
}

interface CompanyDomain {
  company: string;
  domain: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchBuiltWithData(domain: string): Promise<any> {
  try {
    if (!BUILTWITH_API_KEY) {
      console.warn("No BuiltWith API key provided, using limited free tier");
    }

    const url = `https://api.builtwith.com/v20/api.json`;
    const params = {
      KEY: BUILTWITH_API_KEY,
      LOOKUP: domain,
      NOMETA: "1",
      NOATTR: "0",
    };

    const response = await axios.get(url, {
      params,
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching BuiltWith data for ${domain}:`, error);
    return null;
  }
}

async function parseBuiltWithResponse(
  domain: string,
  data: any
): Promise<{
  technologies: BuiltWithTechnology[];
  summary: BuiltWithSummary;
}> {
  const technologies: BuiltWithTechnology[] = [];
  const categoryCounts: Record<string, number> = {};
  const frameworkStack: string[] = [];
  const analyticsTools: string[] = [];
  const advertisingTools: string[] = [];
  const ecommerceTools: string[] = [];

  let primaryLanguage: string | undefined;
  let hostingProvider: string | undefined;
  let cdnProvider: string | undefined;
  let cmsProvider: string | undefined;

  const currentDate = new Date().toISOString().split("T")[0];

  // Parse technology groups
  if (data.Results && data.Results[0]) {
    const result = data.Results[0];
    const paths = result.Paths || [];

    for (const path of paths) {
      if (!path.Technologies) continue;

      for (const tech of path.Technologies) {
        const category = tech.Tag || "Other";
        const techName = tech.Name || "";
        const firstDetected = tech.FirstDetected || currentDate;
        const lastDetected = tech.LastDetected || currentDate;
        const isCurrent = !tech.IsDead;

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;

        // Track specific technology types
        if (category === "Framework") frameworkStack.push(techName);
        if (category === "Analytics") analyticsTools.push(techName);
        if (category === "Advertising") advertisingTools.push(techName);
        if (category === "Ecommerce") ecommerceTools.push(techName);
        if (category === "Programming Languages" && !primaryLanguage)
          primaryLanguage = techName;
        if (category === "Hosting" && !hostingProvider)
          hostingProvider = techName;
        if (category === "CDN" && !cdnProvider) cdnProvider = techName;
        if (category === "CMS" && !cmsProvider) cmsProvider = techName;

        technologies.push({
          PK: `company#${domain}`,
          SK: `tech#${normalizeString(category)}#${normalizeString(techName)}`,
          GSI1PK: `technology#${normalizeString(techName)}`,
          GSI1SK: `company#${domain}`,
          domain,
          technology: techName,
          category,
          subcategory: tech.SubTag,
          firstDetected,
          lastDetected,
          isCurrent,
          confidence: tech.Confidence || 100,
          scrapedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Create summary
  const topTechnologies = technologies
    .filter((t) => t.isCurrent)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map((t) => ({ name: t.technology, category: t.category }));

  const summary: BuiltWithSummary = {
    PK: `company#${domain}`,
    SK: `summary#${currentDate}`,
    domain,
    totalTechnologies: technologies.filter((t) => t.isCurrent).length,
    categories: categoryCounts,
    topTechnologies,
    primaryLanguage,
    frameworkStack,
    hostingProvider,
    cdnProvider,
    analyticsTools,
    advertisingTools,
    ecommerceTools,
    cmsProvider,
    scrapedAt: new Date().toISOString(),
  };

  return { technologies, summary };
}

async function scrapeCompanyTechStack(
  companies: CompanyDomain[]
): Promise<any[]> {
  const allItems: any[] = [];

  for (const { company, domain } of companies) {
    try {
      console.log(`Scraping tech stack for ${company} (${domain})...`);

      const data = await fetchBuiltWithData(domain);

      if (data) {
        const { technologies, summary } = await parseBuiltWithResponse(
          domain,
          data
        );

        allItems.push(summary);
        allItems.push(...technologies);

        console.log(`Found ${technologies.length} technologies for ${domain}`);
      }

      await delay(DELAY_MS);
    } catch (error) {
      console.error(`Error processing ${domain}:`, error);
    }
  }

  return allItems;
}

async function scrapeTechnologyAdoption(technology: string): Promise<any[]> {
  const items: any[] = [];

  try {
    console.log(`Finding companies using ${technology}...`);

    // Note: This requires BuiltWith Trends API (paid feature)
    const url = `https://api.builtwith.com/trends/v5/technology/${encodeURIComponent(
      technology
    )}`;
    const params = {
      KEY: BUILTWITH_API_KEY,
    };

    const response = await axios.get(url, {
      params,
      timeout: 15000,
    });

    const data = response.data;

    if (data.Domains) {
      for (const domain of data.Domains) {
        items.push({
          PK: `technology#${normalizeString(technology)}`,
          SK: `company#${domain}`,
          GSI1PK: `company#${domain}`,
          GSI1SK: `technology#${normalizeString(technology)}`,
          technology,
          domain,
          detected: new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
        });
      }
    }

    await delay(DELAY_MS);
  } catch (error) {
    console.error(`Error finding companies for ${technology}:`, error);
  }

  return items;
}

async function getTechnologyTrends(technologies: string[]): Promise<any[]> {
  const items: any[] = [];

  for (const tech of technologies) {
    try {
      const url = `https://api.builtwith.com/trends/v5/technology/${encodeURIComponent(
        tech
      )}`;
      const params = {
        KEY: BUILTWITH_API_KEY,
      };

      const response = await axios.get(url, {
        params,
        timeout: 15000,
      });

      const data = response.data;
      const currentDate = new Date().toISOString().split("T")[0];

      items.push({
        PK: `technology#${normalizeString(tech)}`,
        SK: `trends#${currentDate}`,
        technology: tech,
        totalSites: data.Total || 0,
        growthRate: data.Growth || 0,
        topCountries: data.Countries || [],
        topIndustries: data.Industries || [],
        averageTraffic: data.AverageTraffic || 0,
        scrapedAt: new Date().toISOString(),
      });

      await delay(DELAY_MS);
    } catch (error) {
      console.error(`Error getting trends for ${tech}:`, error);
    }
  }

  return items;
}

async function saveToDynamoDB(items: any[]): Promise<void> {
  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  for (const batch of batches) {
    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        })
      );
      console.log(`Saved batch of ${batch.length} items`);
    } catch (error) {
      console.error("Error saving batch:", error);
    }
    await delay(100);
  }
}

export const handler = async (event: any) => {
  try {
    console.log("Starting BuiltWith scraper...");

    const allItems: any[] = [];

    // Scrape company tech stacks
    if (event.companies) {
      const companies: CompanyDomain[] = event.companies.map((c: any) => ({
        company: c.name || c.company,
        domain: c.domain || c.website,
      }));

      const companyData = await scrapeCompanyTechStack(companies);
      allItems.push(...companyData);
      console.log(`Scraped ${companies.length} companies`);
    }

    // Find companies using specific technologies
    if (event.findCompaniesUsing) {
      for (const tech of event.findCompaniesUsing) {
        const adoptionData = await scrapeTechnologyAdoption(tech);
        allItems.push(...adoptionData);
      }
    }

    // Get technology trends
    if (event.getTrends) {
      const trendsData = await getTechnologyTrends(event.getTrends);
      allItems.push(...trendsData);
    }

    // Save to DynamoDB
    if (allItems.length > 0) {
      await saveToDynamoDB(allItems);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "BuiltWith scraping completed",
        itemsScraped: allItems.length,
      }),
    };
  } catch (error) {
    console.error("Fatal error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error scraping BuiltWith",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
