import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import axios from "axios";
import * as cheerio from "cheerio";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || "glassdoor-data";
const DELAY_MS = 2000; // Be respectful with scraping

/**
 * Table Structure:
 * PK: company#<companyName> | jobTitle#<normalizedTitle>
 * SK: salary#<location>#<timestamp> | review#<reviewId> | rating#<timestamp>
 *
 * Example items:
 * - company#Google | salary#USA#2025-10-11 | { avgSalary, range, sampleSize }
 * - company#Google | review#abc123 | { rating, review, pros, cons, date }
 * - jobTitle#Software-Engineer | salary#San-Francisco#2025-10-11 | { avgSalary, range }
 */

interface GlassdoorSalary {
  PK: string;
  SK: string;
  avgSalary: number;
  salaryRange: { min: number; max: number };
  location: string;
  jobTitle?: string;
  companyName?: string;
  sampleSize: number;
  currency: string;
  scrapedAt: string;
  source: string;
}

interface GlassdoorReview {
  PK: string;
  SK: string;
  reviewId: string;
  companyName: string;
  rating: number;
  reviewTitle: string;
  reviewText: string;
  pros: string;
  cons: string;
  advice?: string;
  jobTitle: string;
  location: string;
  employmentStatus: string;
  reviewDate: string;
  helpful: number;
  scrapedAt: string;
}

interface GlassdoorCompanyRating {
  PK: string;
  SK: string;
  companyName: string;
  overallRating: number;
  ceoRating: number;
  recommendToFriend: number;
  careerOpportunities: number;
  compBenefits: number;
  culturalValues: number;
  diversityInclusion: number;
  workLifeBalance: number;
  seniorManagement: number;
  totalReviews: number;
  scrapedAt: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function scrapeGlassdoorSalaries(
  searchTerms: string[]
): Promise<GlassdoorSalary[]> {
  const salaries: GlassdoorSalary[] = [];

  for (const term of searchTerms) {
    try {
      console.log(`Scraping salary data for: ${term}`);

      // Note: Glassdoor requires authentication for full access
      // This is a simplified scraper - production would need proper auth
      const url = `https://www.glassdoor.com/Salaries/${normalizeString(
        term
      )}-salary-SRCH_KO0,${term.length}.htm`;

      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      // Extract salary data (selectors may need updating)
      $(".salary-data").each((i, elem) => {
        const avgSalaryText = $(elem).find(".salary-avg").text();
        const rangeText = $(elem).find(".salary-range").text();
        const location = $(elem).find(".location").text() || "USA";
        const sampleSizeText = $(elem).find(".sample-size").text();

        const avgSalary = parseInt(avgSalaryText.replace(/[^0-9]/g, "")) || 0;
        const sampleSize = parseInt(sampleSizeText.replace(/[^0-9]/g, "")) || 0;

        if (avgSalary > 0) {
          const normalized = normalizeString(term);
          salaries.push({
            PK: `jobTitle#${normalized}`,
            SK: `salary#${normalizeString(location)}#${
              new Date().toISOString().split("T")[0]
            }`,
            avgSalary,
            salaryRange: parseSalaryRange(rangeText),
            location,
            jobTitle: term,
            sampleSize,
            currency: "USD",
            scrapedAt: new Date().toISOString(),
            source: "glassdoor",
          });
        }
      });

      await delay(DELAY_MS);
    } catch (error) {
      console.error(`Error scraping salary for ${term}:`, error);
    }
  }

  return salaries;
}

async function scrapeGlassdoorReviews(
  companyName: string,
  maxPages = 5
): Promise<GlassdoorReview[]> {
  const reviews: GlassdoorReview[] = [];

  try {
    console.log(`Scraping reviews for: ${companyName}`);

    for (let page = 1; page <= maxPages; page++) {
      const url = `https://www.glassdoor.com/Reviews/${normalizeString(
        companyName
      )}-reviews-SRCH_KE0,${
        companyName.length
      }.htm?sort.sortType=RD&sort.ascending=false&filter.employmentStatus=REGULAR&filter.employmentStatus=PART_TIME&p=${page}`;

      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      $(".review-item, .empReview").each((i, elem) => {
        const $review = $(elem);

        const reviewId =
          $review.attr("data-review-id") || `review-${Date.now()}-${i}`;
        const rating = parseFloat($review.find(".rating-score").text()) || 0;
        const reviewTitle = $review.find(".review-title").text().trim();
        const reviewText = $review.find(".review-text").text().trim();
        const pros = $review.find(".pros").text().replace("Pros", "").trim();
        const cons = $review.find(".cons").text().replace("Cons", "").trim();
        const advice = $review
          .find(".advice")
          .text()
          .replace("Advice to Management", "")
          .trim();
        const jobTitle = $review.find(".job-title").text().trim();
        const location = $review.find(".location").text().trim();
        const employmentStatus = $review
          .find(".employment-status")
          .text()
          .trim();
        const reviewDate = $review.find(".review-date").text().trim();
        const helpful = parseInt($review.find(".helpful-count").text()) || 0;

        if (reviewId && rating > 0) {
          reviews.push({
            PK: `company#${normalizeString(companyName)}`,
            SK: `review#${reviewId}`,
            reviewId,
            companyName,
            rating,
            reviewTitle,
            reviewText,
            pros,
            cons,
            advice: advice || undefined,
            jobTitle,
            location,
            employmentStatus,
            reviewDate,
            helpful,
            scrapedAt: new Date().toISOString(),
          });
        }
      });

      await delay(DELAY_MS);
    }
  } catch (error) {
    console.error(`Error scraping reviews for ${companyName}:`, error);
  }

  return reviews;
}

async function scrapeCompanyRating(
  companyName: string
): Promise<GlassdoorCompanyRating | null> {
  try {
    console.log(`Scraping company rating for: ${companyName}`);

    const url = `https://www.glassdoor.com/Overview/Working-at-${normalizeString(
      companyName
    )}-EI_IE${companyName.length}.htm`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    const rating: GlassdoorCompanyRating = {
      PK: `company#${normalizeString(companyName)}`,
      SK: `rating#${new Date().toISOString().split("T")[0]}`,
      companyName,
      overallRating: parseFloat($(".rating-overall").text()) || 0,
      ceoRating: parseFloat($(".ceo-rating").text()) || 0,
      recommendToFriend: parseFloat($(".recommend-rating").text()) || 0,
      careerOpportunities:
        parseFloat($('[data-test="career-opportunities"]').text()) || 0,
      compBenefits: parseFloat($('[data-test="comp-benefits"]').text()) || 0,
      culturalValues: parseFloat($('[data-test="culture-values"]').text()) || 0,
      diversityInclusion:
        parseFloat($('[data-test="diversity-inclusion"]').text()) || 0,
      workLifeBalance:
        parseFloat($('[data-test="work-life-balance"]').text()) || 0,
      seniorManagement: parseFloat($('[data-test="senior-mgmt"]').text()) || 0,
      totalReviews:
        parseInt(
          $(".total-reviews")
            .text()
            .replace(/[^0-9]/g, "")
        ) || 0,
      scrapedAt: new Date().toISOString(),
    };

    return rating;
  } catch (error) {
    console.error(`Error scraping rating for ${companyName}:`, error);
    return null;
  }
}

function parseSalaryRange(rangeText: string): { min: number; max: number } {
  const numbers = rangeText.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    return {
      min: parseInt(numbers[0]) * 1000,
      max: parseInt(numbers[1]) * 1000,
    };
  }
  return { min: 0, max: 0 };
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
      // Fallback to individual puts
      for (const item of batch) {
        try {
          await docClient.send(
            new PutCommand({
              TableName: TABLE_NAME,
              Item: item,
            })
          );
        } catch (e) {
          console.error("Error saving item:", e);
        }
      }
    }
  }
}

export const handler = async (event: any) => {
  try {
    console.log("Starting Glassdoor scraper...");

    const jobTitles = event.jobTitles || [
      "Software Engineer",
      "Data Scientist",
      "Product Manager",
    ];
    const companies = event.companies || ["Google", "Amazon", "Microsoft"];

    const allItems: any[] = [];

    // Scrape salaries
    const salaries = await scrapeGlassdoorSalaries(jobTitles);
    allItems.push(...salaries);
    console.log(`Scraped ${salaries.length} salary records`);

    // Scrape company ratings and reviews
    for (const company of companies) {
      const rating = await scrapeCompanyRating(company);
      if (rating) allItems.push(rating);

      const reviews = await scrapeGlassdoorReviews(company, 2);
      allItems.push(...reviews);
      console.log(`Scraped ${reviews.length} reviews for ${company}`);

      await delay(DELAY_MS);
    }

    // Save to DynamoDB
    if (allItems.length > 0) {
      await saveToDynamoDB(allItems);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Glassdoor scraping completed",
        itemsScraped: allItems.length,
        salaries: salaries.length,
        companies: companies.length,
      }),
    };
  } catch (error) {
    console.error("Fatal error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error scraping Glassdoor",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
