import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import axios from "axios";
import cheerio from "cheerio";

const s3Client = new S3Client({});

// Environment variables
const MUSE_API_KEY = process.env.MUSE_API_KEY || "";
const S3_BUCKET = process.env.S3_BUCKET || "job-postings-bucket-cstannahill";
const MAX_PAGES_PER_RUN = 500; // Maximum pages to fetch per Lambda execution
const DELAY_BETWEEN_REQUESTS = 100; // ms delay between API calls to be respectful

interface MuseJob {
  id: number;
  name: string;
  locations: Array<{ name: string }>;
  contents: string;
  publication_date: string;
  levels: Array<{ name: string }>;
  categories: Array<{ name: string }>;
}

interface MuseApiResponse {
  page: number;
  page_count: number;
  items_per_page: number;
  took: number;
  timed_out: boolean;
  total: number;
  results: MuseJob[];
}

function isDevRole(name: string): boolean {
  const devKeywords = [
    "developer",
    "engineer",
    "programmer",
    "architect",
    "devops",
    "sre",
    "data engineer",
    "ml engineer",
    "software",
    "backend",
    "frontend",
    "fullstack",
    "full stack",
    "platform engineer",
    "cloud engineer",
    "security engineer",
    "qa engineer",
    "mobile developer",
    "web developer",
    "embedded",
  ];
  const titleLower = name.toLowerCase();
  return devKeywords.some((keyword) => titleLower.includes(keyword));
}

export const handler = async (): Promise<{
  statusCode: number;
  body: string;
}> => {
  console.log("Starting paginated job scraper...");

  const results = {
    muse: 0,
    pagesProcessed: 0,
    totalPages: 0,
    skippedNonDev: 0,
    errors: [] as string[],
  };

  try {
    const allJobs = await fetchAllMuseJobs(results);

    for (const job of allJobs) {
      const name =
        job && typeof job.name === "string"
          ? job.name
          : String(job?.name ?? "");

      if (!isDevRole(name)) {
        console.debug("Skipping non-dev role:", name);
        results.skippedNonDev++;
        continue;
      }

      try {
        const key = await saveJsonObjectToS3(
          job,
          "muse",
          String(job.id || Date.now())
        );
        if (key) results.muse++;
      } catch (err) {
        console.error("Error saving Muse JSON:", err);
        results.errors.push(
          `Muse: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    console.log("Scraper completed:", results);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Job scraping completed", results }),
    };
  } catch (error) {
    console.error("Fatal error in scraper:", error);
    throw error;
  }
};

async function fetchAllMuseJobs(results: any): Promise<MuseJob[]> {
  const baseUrl =
    "https://www.themuse.com/api/public/jobs?category=Data%20and%20Analytics&category=Data%20Science&category=Design%20and%20UX&category=Software%20Engineer&category=Software%20Engineering&page=0";
  const params = {};
  const allJobs: MuseJob[] = [];
  let currentPage = 0;
  let totalPages = 0;

  try {
    // Fetch first page to get metadata
    console.log("Fetching page 0 to determine total pages...");
    const firstResponse = await fetchMusePage(baseUrl, 0, params);

    totalPages = firstResponse.page_count;
    results.totalPages = totalPages;

    console.log(`Total pages available: ${totalPages}`);
    console.log(`Total jobs available: ${firstResponse.total}`);
    console.log(`Will fetch up to ${MAX_PAGES_PER_RUN} pages`);

    // Process first page
    const sanitizedFirstPage = sanitizeJobs(firstResponse.results);
    allJobs.push(...sanitizedFirstPage);
    results.pagesProcessed = 1;

    // Calculate how many more pages to fetch
    const pagesToFetch = Math.min(totalPages - 1, MAX_PAGES_PER_RUN - 1);

    // Fetch remaining pages
    for (let page = 1; page <= pagesToFetch; page++) {
      try {
        console.log(`Fetching page ${page} of ${totalPages}...`);

        // Add delay to be respectful to the API
        if (DELAY_BETWEEN_REQUESTS > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
          );
        }

        const response = await fetchMusePage(baseUrl, page, params);
        const sanitizedJobs = sanitizeJobs(response.results);
        allJobs.push(...sanitizedJobs);
        results.pagesProcessed++;

        console.log(`Page ${page} fetched: ${sanitizedJobs.length} jobs`);
      } catch (err) {
        const errorMsg = `Error fetching page ${page}: ${
          err instanceof Error ? err.message : String(err)
        }`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
        // Continue with other pages even if one fails
      }
    }

    console.log(
      `Total jobs fetched across ${results.pagesProcessed} pages: ${allJobs.length}`
    );
    return allJobs;
  } catch (err) {
    console.error("Error in fetchAllMuseJobs:", err);
    results.errors.push(
      `Muse pagination failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return allJobs; // Return whatever we managed to fetch
  }
}

async function fetchMusePage(
  baseUrl: string,
  page: number,
  params?: any
): Promise<MuseApiResponse> {
  try {
    const response = await axios.get(baseUrl, {
      params: {
        ...params,
        page,
        api_key: MUSE_API_KEY,
      },
      timeout: 15000,
    });

    return response.data;
  } catch (err) {
    console.error(`Error fetching Muse page ${page}:`, err);
    throw err;
  }
}

function sanitizeJobs(jobs: any[]): MuseJob[] {
  return jobs.map((j) => {
    const raw = j && (j.contents || j.contents === "") ? j.contents : "";
    try {
      const $ = cheerio.load(String(raw));
      const text = $("body").text().replace(/\s+/g, " ").trim();
      return { ...j, contents: text };
    } catch (e) {
      const text = String(raw)
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return { ...j, contents: text };
    }
  });
}

async function saveJsonObjectToS3(
  obj: any,
  source: "muse" | "adzuna",
  id: string
): Promise<string | null> {
  const key = `${source}-${id}.json`;

  // Check existence to avoid duplicates
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    console.log(`Skipping raw JSON upload for ${key}: object already exists`);
    return null;
  } catch (headErr) {
    const status =
      (headErr as any)?.$metadata?.httpStatusCode ||
      (headErr as any)?.statusCode ||
      0;
    if (status && status !== 404)
      console.warn(
        `HeadObject check for ${key} returned status ${status}, proceeding to upload`
      );
  }

  const body = JSON.stringify(obj, null, 2);
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: "application/json",
  });
  await s3Client.send(cmd);
  console.log(`Saved raw JSON to S3: ${key}`);
  return key;
}
