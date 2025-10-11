import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import axios from "axios";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || "angellist-data";
const DELAY_MS = 1500;

/**
 * Table Structure:
 * PK: company#<companyId>
 * SK: job#<jobId> | funding#<roundType>#<date> | metadata#current
 *
 * Example items:
 * - company#12345 | job#67890 | { title, equity, salary, stage }
 * - company#12345 | funding#SeriesA#2024-01 | { amount, investors, valuation }
 * - company#12345 | metadata#current | { name, size, stage, totalFunding }
 */

interface AngelListJob {
  PK: string;
  SK: string;
  jobId: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  remote: boolean;
  salaryRange?: { min: number; max: number };
  equityRange?: { min: number; max: number };
  experienceLevel: string;
  jobType: string;
  skills: string[];
  description: string;
  postedDate: string;
  scrapedAt: string;
}

interface AngelListFunding {
  PK: string;
  SK: string;
  companyId: string;
  companyName: string;
  roundType: string;
  amount: number;
  currency: string;
  announcedDate: string;
  investors: string[];
  leadInvestor?: string;
  valuation?: number;
  scrapedAt: string;
}

interface AngelListCompany {
  PK: string;
  SK: string;
  companyId: string;
  name: string;
  website: string;
  description: string;
  stage: string;
  size: string;
  founded: number;
  location: string;
  industry: string[];
  totalFunding: number;
  lastFundingDate?: string;
  lastFundingRound?: string;
  employeeCount?: number;
  techStack: string[];
  scrapedAt: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeAngelListJobs(filters: any = {}): Promise<AngelListJob[]> {
  const jobs: AngelListJob[] = [];

  try {
    // AngelList has an API but requires authentication
    // Using their job search endpoint
    const params = new URLSearchParams({
      page: "1",
      per_page: "50",
      filter_data: JSON.stringify({
        role_types: filters.roleTypes || ["Engineering", "Data Science"],
        locations: filters.locations || ["Remote", "United States"],
        experience_levels: filters.experienceLevels || [
          "mid_level",
          "senior",
          "lead",
        ],
      }),
    });

    const response = await axios.get(
      `https://angel.co/api/jobs/search?${params}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const jobListings = response.data.jobs || response.data.results || [];

    for (const job of jobListings) {
      const companyId = String(job.startup?.id || job.company_id || "");
      const jobId = String(job.id);

      jobs.push({
        PK: `company#${companyId}`,
        SK: `job#${jobId}`,
        jobId,
        companyId,
        companyName: job.startup?.name || job.company_name || "",
        title: job.title || "",
        location: job.location || "",
        remote: job.remote || false,
        salaryRange: job.salary_range
          ? {
              min: job.salary_range.min || 0,
              max: job.salary_range.max || 0,
            }
          : undefined,
        equityRange: job.equity_range
          ? {
              min: parseFloat(job.equity_range.min) || 0,
              max: parseFloat(job.equity_range.max) || 0,
            }
          : undefined,
        experienceLevel: job.experience_level || "mid_level",
        jobType: job.job_type || "full_time",
        skills: job.skills || job.tags || [],
        description: job.description || "",
        postedDate: job.posted_at || job.created_at || new Date().toISOString(),
        scrapedAt: new Date().toISOString(),
      });
    }

    await delay(DELAY_MS);
  } catch (error) {
    console.error("Error scraping AngelList jobs:", error);
  }

  return jobs;
}

async function scrapeCompanyFunding(
  companyId: string
): Promise<AngelListFunding[]> {
  const fundingRounds: AngelListFunding[] = [];

  try {
    const response = await axios.get(
      `https://angel.co/api/startups/${companyId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const company = response.data;
    const companyName = company.name || "";

    if (company.funding_rounds) {
      for (const round of company.funding_rounds) {
        fundingRounds.push({
          PK: `company#${companyId}`,
          SK: `funding#${round.round_type}#${round.announced_date}`,
          companyId,
          companyName,
          roundType: round.round_type || "",
          amount: round.amount || 0,
          currency: round.currency || "USD",
          announcedDate: round.announced_date || "",
          investors: round.investors?.map((inv: any) => inv.name) || [],
          leadInvestor: round.lead_investor?.name,
          valuation: round.valuation,
          scrapedAt: new Date().toISOString(),
        });
      }
    }

    await delay(DELAY_MS);
  } catch (error) {
    console.error(`Error scraping funding for company ${companyId}:`, error);
  }

  return fundingRounds;
}

async function scrapeCompanyMetadata(
  companyId: string
): Promise<AngelListCompany | null> {
  try {
    const response = await axios.get(
      `https://angel.co/api/startups/${companyId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
        timeout: 15000,
      }
    );

    const company = response.data;

    // Get total funding
    let totalFunding = 0;
    let lastRound = null;
    if (company.funding_rounds) {
      totalFunding = company.funding_rounds.reduce(
        (sum: number, r: any) => sum + (r.amount || 0),
        0
      );
      const sorted = company.funding_rounds.sort(
        (a: any, b: any) =>
          new Date(b.announced_date).getTime() -
          new Date(a.announced_date).getTime()
      );
      lastRound = sorted[0];
    }

    return {
      PK: `company#${companyId}`,
      SK: "metadata#current",
      companyId,
      name: company.name || "",
      website: company.website || "",
      description: company.description || "",
      stage: company.stage || "",
      size: company.company_size || "",
      founded: company.year_founded || 0,
      location: company.location || "",
      industry: company.markets?.map((m: any) => m.name) || [],
      totalFunding,
      lastFundingDate: lastRound?.announced_date,
      lastFundingRound: lastRound?.round_type,
      employeeCount: company.employee_count,
      techStack: company.tech_stack || [],
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping metadata for company ${companyId}:`, error);
    return null;
  }
}

async function searchStartups(filters: any = {}): Promise<string[]> {
  const companyIds: string[] = [];

  try {
    const params = new URLSearchParams({
      page: "1",
      per_page: "100",
      filter_data: JSON.stringify({
        markets: filters.industries || ["B2B", "SaaS", "Developer Tools"],
        stage: filters.stages || ["seed", "series_a", "series_b"],
        locations: filters.locations || ["United States", "Remote"],
      }),
    });
    let response: any = {};
    const startups: any[] = [];
    try {
      response = await axios.get(`https://angel.co/api/jobs/search?${params}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://wellfound.com/",
        },
        timeout: 15000,
        maxRedirects: 5,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error("Error response data:", error.response.data);
          console.error("Error response status:", error.response.status);
          console.error("Error response headers:", error.response.headers);
        } else if (error.request) {
          console.error("No response received:", error.request);
        } else {
          console.error("Axios error message:", error.message);
        }
      } else {
        console.error("Non-Axios error:", error);
      }
      throw error; // Re-throw after logging
    }

    console.log("Response status:", response.status);
    // Node/axios: final URL (if available)
    console.log(
      "Response final URL:",
      (response.request?.res && response.request.res.responseUrl) ||
        response.config.url
    );
    console.log("Response headers:", response.headers);
    console.log(
      "Response body length:",
      (response.data && JSON.stringify(response.data).length) || 0
    );

    const jobListings = response.data.jobs || response.data.results || [];
    companyIds.push(...startups.map((s: any) => String(s.id)));

    await delay(DELAY_MS);
  } catch (error) {
    console.error("Error searching startups:", error);
  }

  return companyIds;
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
    console.log("Starting AngelList scraper...");

    const allItems: any[] = [];

    // Scrape jobs
    const jobs = await scrapeAngelListJobs(event.jobFilters);
    allItems.push(...jobs);
    console.log(`Scraped ${jobs.length} job listings`);

    // Get unique company IDs from jobs
    const companyIds = [...new Set(jobs.map((j) => j.companyId))];

    // Scrape additional companies if specified
    if (event.searchStartups) {
      const additionalIds = await searchStartups(event.startupFilters);
      companyIds.push(...additionalIds);
    }

    // Scrape company metadata and funding for each company
    for (const companyId of companyIds.slice(0, event.maxCompanies || 50)) {
      const metadata = await scrapeCompanyMetadata(companyId);
      if (metadata) allItems.push(metadata);

      const funding = await scrapeCompanyFunding(companyId);
      allItems.push(...funding);

      console.log(`Scraped data for company ${companyId}`);
      await delay(DELAY_MS);
    }

    // Save to DynamoDB
    if (allItems.length > 0) {
      await saveToDynamoDB(allItems);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "AngelList scraping completed",
        itemsScraped: allItems.length,
        jobs: jobs.length,
        companies: companyIds.length,
      }),
    };
  } catch (error) {
    console.error("Fatal error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error scraping AngelList",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
