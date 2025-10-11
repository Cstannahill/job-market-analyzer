import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import * as cheerio from "cheerio";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || "stackoverflow-jobs";
const DELAY_MS = 1000;

/**
 * Table Structure:
 * PK: job#<jobId>
 * SK: posted#<date>
 *
 * GSI1:
 * PK: company#<companyName>
 * SK: posted#<date>
 *
 * GSI2:
 * PK: tag#<technology>
 * SK: posted#<date>
 *
 * Example items:
 * - job#12345 | posted#2025-10-11 | { title, company, salary, tags, remote }
 */

interface StackOverflowJob {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  jobId: string;
  title: string;
  company: string;
  companySize?: string;
  location: string;
  remote: boolean;
  remoteType?: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: string;
  };
  tags: string[];
  technologies: string[];
  description: string;
  requirements: string[];
  benefits: string[];
  experienceLevel: string;
  jobType: string;
  postedDate: string;
  url: string;
  scrapedAt: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeStackOverflowJobs(
  searchParams: any = {}
): Promise<StackOverflowJob[]> {
  const jobs: StackOverflowJob[] = [];

  try {
    // Stack Overflow Jobs migrated to Stack Overflow Talent
    // Using their RSS feed and web scraping as fallback
    const page = searchParams.page || 1;
    const tags = searchParams.tags || [
      "javascript",
      "python",
      "java",
      "typescript",
    ];
    const location = searchParams.location || "Remote";

    const url =
      `https://stackoverflow.com/jobs/feed?` +
      new URLSearchParams({
        tags: tags.join(","),
        location,
        r: "true", // remote
        u: "Km", // distance units
        pg: String(page),
      });

    console.log(`Scraping Stack Overflow jobs: ${url}`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 15000,
    });

    // Parse RSS/XML feed
    const $ = cheerio.load(response.data, { xmlMode: true });

    $("item").each((i, elem) => {
      const $item = $(elem);

      const link = $item.find("link").text();
      const jobId =
        link.match(/\/jobs\/(\d+)\//)?.[1] || `so-${Date.now()}-${i}`;
      const title = $item.find("title").text();
      const description = $item.find("description").text();
      const pubDate = $item.find("pubDate").text();
      const company = $item.find("a10\\:author a10\\:name, author name").text();
      const locationText = $item.find("location").text();

      // Parse tags from categories
      const tags: string[] = [];
      $item.find("category").each((j, cat) => {
        tags.push($(cat).text());
      });

      // Parse additional details from description
      const descText = $item.find("description").text();
      const $desc = cheerio.load(descText);

      // Extract salary if present
      const salaryText = $desc('*:contains("$")').text();
      const salary = parseSalary(salaryText);

      // Determine if remote
      const remote =
        locationText.toLowerCase().includes("remote") ||
        descText.toLowerCase().includes("remote");

      jobs.push({
        PK: `job#${jobId}`,
        SK: `posted#${
          new Date(pubDate || Date.now()).toISOString().split("T")[0]
        }`,
        GSI1PK: `company#${normalizeString(company)}`,
        GSI1SK: `posted#${
          new Date(pubDate || Date.now()).toISOString().split("T")[0]
        }`,
        jobId,
        title,
        company,
        location: locationText,
        remote,
        remoteType: remote ? detectRemoteType(descText) : undefined,
        salary,
        tags,
        technologies: extractTechnologies(tags, descText),
        description: cleanText(descText),
        requirements: extractRequirements($desc),
        benefits: extractBenefits($desc),
        experienceLevel: detectExperienceLevel(title, descText),
        jobType: detectJobType(descText),
        postedDate: pubDate || new Date().toISOString(),
        url: link,
        scrapedAt: new Date().toISOString(),
      });
    });

    await delay(DELAY_MS);
  } catch (error) {
    console.error("Error scraping Stack Overflow jobs:", error);
  }

  return jobs;
}

async function scrapeJobDetails(
  jobUrl: string
): Promise<Partial<StackOverflowJob> | null> {
  try {
    const response = await axios.get(jobUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    const details: Partial<StackOverflowJob> = {
      description: $(".job-description").text().trim(),
      requirements: [],
      benefits: [],
      salary: undefined,
    };

    // Extract requirements
    $(".requirements li, .qualifications li").each((i, elem) => {
      details.requirements?.push($(elem).text().trim());
    });

    // Extract benefits
    $(".benefits li, .perks li").each((i, elem) => {
      details.benefits?.push($(elem).text().trim());
    });

    // Extract salary if present
    const salaryText = $(".salary-range, .compensation").text();
    if (salaryText) {
      details.salary = parseSalary(salaryText);
    }

    // Extract company size
    const companySize = $(".company-size").text().trim();
    if (companySize) {
      details.companySize = companySize;
    }

    return details;
  } catch (error) {
    console.error(`Error scraping job details from ${jobUrl}:`, error);
    return null;
  }
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSalary(text: string): StackOverflowJob["salary"] | undefined {
  const salaryRegex = /\$?([\d,]+)k?\s*-\s*\$?([\d,]+)k?/i;
  const match = text.match(salaryRegex);

  if (match) {
    const min = parseInt(match[1].replace(/,/g, ""));
    const max = parseInt(match[2].replace(/,/g, ""));

    // Detect if it's in thousands
    const multiplier = text.toLowerCase().includes("k") ? 1000 : 1;

    return {
      min: min * multiplier,
      max: max * multiplier,
      currency: "USD",
      period: detectSalaryPeriod(text),
    };
  }

  return undefined;
}

function detectSalaryPeriod(text: string): string {
  if (/\/(year|yr|annum)/i.test(text)) return "yearly";
  if (/\/(hour|hr)/i.test(text)) return "hourly";
  return "yearly";
}

function extractTechnologies(tags: string[], description: string): string[] {
  const commonTech = [
    "javascript",
    "typescript",
    "python",
    "java",
    "c#",
    "c++",
    "go",
    "rust",
    "ruby",
    "react",
    "angular",
    "vue",
    "node.js",
    "express",
    "django",
    "flask",
    "spring",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "terraform",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "elasticsearch",
    "git",
    "jenkins",
    "gitlab",
    "github actions",
    "circleci",
  ];

  const found = new Set(tags.map((t) => t.toLowerCase()));
  const descLower = description.toLowerCase();

  for (const tech of commonTech) {
    if (descLower.includes(tech.toLowerCase())) {
      found.add(tech);
    }
  }

  return Array.from(found);
}

function extractRequirements($: cheerio.CheerioAPI): string[] {
  const requirements: string[] = [];

  $('*:contains("Requirements"), *:contains("Qualifications")').each(
    (i, elem) => {
      $(elem)
        .next("ul, ol")
        .find("li")
        .each((j, li) => {
          requirements.push($(li).text().trim());
        });
    }
  );

  return requirements.filter((r) => r.length > 0);
}

function extractBenefits($: cheerio.CheerioAPI): string[] {
  const benefits: string[] = [];

  $('*:contains("Benefits"), *:contains("Perks"), *:contains("We Offer")').each(
    (i, elem) => {
      $(elem)
        .next("ul, ol")
        .find("li")
        .each((j, li) => {
          benefits.push($(li).text().trim());
        });
    }
  );

  return benefits.filter((b) => b.length > 0);
}

function detectExperienceLevel(title: string, description: string): string {
  const text = (title + " " + description).toLowerCase();

  if (/\b(senior|sr\.|lead|principal|staff)\b/i.test(text)) return "senior";
  if (/\b(junior|jr\.|entry|graduate)\b/i.test(text)) return "junior";
  return "mid";
}

function detectJobType(description: string): string {
  const text = description.toLowerCase();

  if (text.includes("contract") || text.includes("contractor"))
    return "contract";
  if (text.includes("part-time") || text.includes("part time"))
    return "part-time";
  if (text.includes("internship") || text.includes("intern"))
    return "internship";
  return "full-time";
}

function detectRemoteType(description: string): string {
  const text = description.toLowerCase();

  if (text.includes("fully remote") || text.includes("100% remote"))
    return "fully-remote";
  if (text.includes("hybrid")) return "hybrid";
  if (text.includes("remote-first")) return "remote-first";
  return "remote-allowed";
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
    console.log("Starting Stack Overflow Jobs scraper...");

    const maxPages = event.maxPages || 5;
    const allJobs: StackOverflowJob[] = [];

    // Scrape multiple pages
    for (let page = 1; page <= maxPages; page++) {
      const jobs = await scrapeStackOverflowJobs({ ...event, page });
      allJobs.push(...jobs);
      console.log(`Scraped page ${page}: ${jobs.length} jobs`);

      if (jobs.length === 0) break;

      await delay(DELAY_MS);
    }

    // Optionally scrape detailed info for each job
    if (event.scrapeDetails && allJobs.length > 0) {
      for (const job of allJobs.slice(0, 50)) {
        // Limit to 50 for detailed scraping
        const details = await scrapeJobDetails(job.url);
        if (details) {
          Object.assign(job, details);
        }
        await delay(DELAY_MS);
      }
    }

    // Save to DynamoDB
    if (allJobs.length > 0) {
      await saveToDynamoDB(allJobs);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Stack Overflow Jobs scraping completed",
        jobsScraped: allJobs.length,
        pagesScraped: maxPages,
      }),
    };
  } catch (error) {
    console.error("Fatal error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error scraping Stack Overflow Jobs",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
