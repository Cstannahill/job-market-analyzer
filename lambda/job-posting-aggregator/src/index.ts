import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import axios from "axios";
import cheerio from "cheerio";

const s3Client = new S3Client({});

// Environment variables
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || "";
const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY || "";
const MUSE_API_KEY = process.env.MUSE_API_KEY || "";
const S3_BUCKET = process.env.S3_BUCKET || "job-postings-bucket-cstannahill";
const MAX_JOBS_PER_RUN = 100; // Limit jobs per execution

interface MuseJob {
  id: number;
  name: string;
  locations: Array<{ name: string }>;
  contents: string;
  publication_date: string;
  levels: Array<{ name: string }>;
  categories: Array<{ name: string }>;
}

interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  created: string;
  redirect_url?: string;
  location?: { display_name?: string };
  category?: { label?: string };
  company?: { display_name?: string };
  contents?: string | null;
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
  console.log("Starting job scraper (JSON-only)...");

  const results = { muse: 0, adzuna: 0, errors: [] as string[] };

  try {
    const [museRes] = await Promise.allSettled([
      fetchMuseJobs(),
      // fetchAdzunaJobs(),
    ]);

    if (museRes.status === "fulfilled" && Array.isArray(museRes.value)) {
      for (const job of museRes.value) {
        const name =
          job && typeof job.name === "string"
            ? job.name
            : String(job?.name ?? "");
        if (!isDevRole(name)) {
          // optional: log or count skipped roles
          console.debug("Skipping non-dev role:", name);
          continue;
        }
        try {
          const key = await saveJsonObjectToS3(
            job,
            "muse",
            String((job as any).id || Date.now())
          );
          if (key) results.muse++;
        } catch (err) {
          console.error("Error saving Muse JSON:", err);
          results.errors.push(
            `Muse: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } else if (museRes.status === "rejected") {
      results.errors.push(`Muse API failed: ${museRes.reason}`);
    }

    // if (adzunaRes.status === "fulfilled") {
    //   try {
    //     const meta = adzunaRes.value as any;
    //     if (meta && Array.isArray(meta._rawUploadedKeys))
    //       results.adzuna = meta._rawUploadedKeys.length;
    //     if (
    //       meta &&
    //       meta._processingErrors &&
    //       Array.isArray(meta._processingErrors)
    //     ) {
    //       for (const e of meta._processingErrors)
    //         results.errors.push(`Adzuna: ${e}`);
    //     }
    //   } catch (e) {
    //     console.error("Error reading Adzuna metadata:", e);
    //   }
    // } else if (adzunaRes.status === "rejected") {
    //   results.errors.push(`Adzuna API failed: ${adzunaRes.reason}`);
    // }

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
async function fetchMuseJobs() {
  const BASE_URL = "https://www.themuse.com/api/public/jobs";
  const RESULTS_PER_PAGE = 20; // Assuming Muse API max is 20
  const MAX_PAGES = Math.ceil(MAX_JOBS_PER_RUN / RESULTS_PER_PAGE);
  let allJobs = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const response = await axios.get(BASE_URL, {
        params: {
          api_key: MUSE_API_KEY,
          category: ["Software Engineer", "Software Engineering"],
          location: ["Flexible / Remote", "United States"],
          page: page,
          page_count: RESULTS_PER_PAGE,
        },
      });

      const jobs = response.data.results || [];
      console.log(`Fetched ${jobs.length} jobs from Muse (Page ${page})`);

      allJobs.push(...jobs); // Stop if we've hit the overall limit or the API returns fewer results than expected

      if (
        allJobs.length >= MAX_JOBS_PER_RUN ||
        jobs.length < RESULTS_PER_PAGE
      ) {
        break;
      }
    } catch (err) {
      console.error(`Error fetching Muse jobs on page ${page}:`, err);
      break; // Stop fetching on error
    }
  }
  console.log(`Total fetched ${allJobs.length} jobs from Muse`);

  const sanitized = allJobs.slice(0, MAX_JOBS_PER_RUN).map((j) => {
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
  return sanitized;
}

type AdzunaFetchResult = {
  jobs: AdzunaJob[];
  _rawUploadedKeys: string[];
  _redirectUrls: string[];
  _processingErrors: string[];
};

async function fetchAdzunaJobs(): Promise<AdzunaFetchResult> {
  if (!ADZUNA_APP_ID || !ADZUNA_API_KEY) {
    console.warn("Adzuna credentials not configured, skipping");
    return {
      jobs: [],
      _rawUploadedKeys: [],
      _redirectUrls: [],
      _processingErrors: [],
    };
  }

  try {
    const response = await axios.get(
      `https://api.adzuna.com/v1/api/jobs/us/search/1`,
      {
        params: {
          app_id: ADZUNA_APP_ID,
          app_key: ADZUNA_API_KEY,
          results_per_page: MAX_JOBS_PER_RUN,
          what: "software engineer developer",
        },
        timeout: 10000,
      }
    );

    const jobs: AdzunaJob[] = response.data.results || [];
    console.log(`Fetched ${jobs.length} jobs from Adzuna`);

    const redirectUrls = jobs
      .map((j: any) => j.redirect_url)
      .filter((u: any) => typeof u === "string") as string[];
    try {
      console.log("Adzuna redirect URLs:", JSON.stringify(redirectUrls));
    } catch (e) {
      console.error("Error stringifying redirect URLs", e);
    }

    const errors: string[] = [];

    const fetchPageHtml = async (url: string): Promise<string> => {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.adzuna.com/",
        Connection: "keep-alive",
      };

      const maxAttempts = 3;
      const baseDelay = 500;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const resp = await axios.get(url, {
            headers,
            timeout: 15000,
            responseType: "text",
          });
          return resp.data;
        } catch (err) {
          const status = (err as any)?.response?.status;
          const respBody = (err as any)?.response?.data;
          console.warn(
            `fetchPageHtml attempt ${attempt} failed for ${url}: status=${status} msg=${
              (err as any)?.message
            }`
          );
          if (status === 403 && typeof respBody === "string")
            console.warn(
              `403 body snippet for ${url}:\n${respBody.slice(0, 2000)}`
            );
          if (attempt === maxAttempts) throw err;
          const wait = baseDelay * attempt + Math.floor(Math.random() * 300);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
      throw new Error("unreachable");
    };

    const extractAdpBodyText = (html: string): string | null => {
      try {
        const $ = cheerio.load(html);
        const sel1 = $("section.adp-body").first();
        if (sel1 && sel1.length) {
          const t = sel1.text().trim().replace(/\s+/g, " ");
          if (t) return t;
        }

        // clearancejobs specific selector fallback (preserve from earlier work)
        const selClearance = $(
          "#app > div > div.job-view > div.job-view__body > div.job-view__body-left > div > div:nth-child(1) > div.job-description > div.job-description-text"
        ).first();
        if (selClearance && selClearance.length) {
          const t = selClearance.text().trim().replace(/\s+/g, " ");
          if (t) return t;
        }

        const fallbackSelectors = [
          "div.job-description-text",
          "div.job-description",
          "div.description",
          "article",
          "#job-description",
          "div.job-body",
          "div.description-content",
        ];
        for (const s of fallbackSelectors) {
          const el = $(s).first();
          if (el && el.length) {
            const t = el.text().trim().replace(/\s+/g, " ");
            if (t) return t;
          }
        }

        let bestText = "";
        $("div").each((i, el) => {
          const txt = $(el).text().trim().replace(/\s+/g, " ");
          if (txt.length > bestText.length && txt.length > 200) bestText = txt;
        });
        if (bestText) return bestText;
        return null;
      } catch (e) {
        console.error("Cheerio parse error:", e);
        return null;
      }
    };

    for (const url of redirectUrls) {
      try {
        const html = await fetchPageHtml(url);
        const bodyText = extractAdpBodyText(html);
        if (!bodyText) {
          const msg = `Missing <section class="adp-body"> on ${url}`;
          console.error(msg);
          errors.push(msg);
          continue;
        }
        const jobObj =
          (jobs as any).find((x: any) => x.redirect_url === url) || null;
        if (jobObj) (jobObj as any).contents = bodyText;
        else {
          (jobs as any)._orphanExtracts = (jobs as any)._orphanExtracts || [];
          (jobs as any)._orphanExtracts.push({ url, contents: bodyText });
        }
      } catch (err) {
        const msg = `Error processing ${url}: ${
          err instanceof Error ? err.message : String(err)
        }`;
        console.error(msg);
        errors.push(msg);
      }
    }

    const savedKeys: string[] = [];
    for (const j of jobs) {
      try {
        const id =
          (j as any).id || (j as any).job_id || (j as any).uuid || Date.now();
        const key = await saveJsonObjectToS3(j, "adzuna", String(id));
        if (key) savedKeys.push(key);
      } catch (err) {
        const msg = `Save JSON failed for ${
          (j && ((j as any).id || (j as any).job_id || (j as any).uuid)) ||
          "unknown"
        }: ${err instanceof Error ? err.message : String(err)}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return {
      jobs,
      _rawUploadedKeys: savedKeys,
      _redirectUrls: redirectUrls,
      _processingErrors: errors,
    };
  } catch (err) {
    console.error("Adzuna fetch failed:", err);
    return {
      jobs: [],
      _rawUploadedKeys: [],
      _redirectUrls: [],
      _processingErrors: [String(err)],
    };
  }
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
