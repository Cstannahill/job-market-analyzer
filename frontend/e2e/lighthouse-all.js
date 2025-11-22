import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const BASE_URL =
  process.env.BASE_URL || "https://main.d2qk81z2cubp0y.amplifyapp.com";
const ROUTES = [
  "/",
  "/trends",
  "/top-tech",
  "/postings",
  "/about",
  "/login",
  "/register",
];

const OUT_DIR = path.resolve(process.cwd(), "lighthouse-reports");

/**
 * Ensure output directory exists
 */
async function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

/**
 * Run Lighthouse for a single URL
 */
async function runLighthouseForRoute(route) {
  const url = new URL(route, BASE_URL).toString();
  console.log(`\n=== Running Lighthouse for ${url} ===`);

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox"],
  });

  try {
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        logLevel: "info",
        output: ["json", "html"], // we want both
      },
      {
        extends: "lighthouse:default",
        settings: {
          onlyCategories: ["accessibility", "best-practices", "seo"],
          formFactor: "desktop",
          screenEmulation: {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          },
        },
        throttlingMethod: "simulate",
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      }
    );

    // Depending on version, result.report is either a string or array of strings.
    const reports = Array.isArray(result.report)
      ? result.report
      : [result.report];

    const jsonReport = reports.find((r) => r.trim().startsWith("{"));
    const htmlReport = reports.find((r) => r.trim().startsWith("<"));

    const baseName = (route.replace(/\//g, "_") || "home").replace(/^_/, "");

    if (jsonReport) {
      fs.writeFileSync(
        path.join(OUT_DIR, `${baseName}.report.json`),
        jsonReport,
        "utf-8"
      );
    }
    if (htmlReport) {
      fs.writeFileSync(
        path.join(OUT_DIR, `${baseName}.report.html`),
        htmlReport,
        "utf-8"
      );
    }

    const { lhr } = result;

    // Category scores (0–100)
    const scores = {};
    for (const [key, cat] of Object.entries(lhr.categories)) {
      scores[key] = Math.round((cat.score || 0) * 100);
    }

    // "Warnings"/discrepancies: audits that didn't score 1.0 and are relevant
    const failedAudits = Object.values(lhr.audits)
      .filter((audit) => {
        if (!audit) return false;
        // ignore notApplicable / manual / informative style ones
        if (
          audit.scoreDisplayMode &&
          ["manual", "notApplicable", "informative"].includes(
            audit.scoreDisplayMode
          )
        ) {
          return false;
        }
        return audit.score !== null && audit.score < 1;
      })
      .map((a) => ({
        id: a.id,
        title: a.title,
        score: a.score,
        displayValue: a.displayValue,
        description: a.description,
        scoreDisplayMode: a.scoreDisplayMode,
      }));

    // Log a quick summary to console
    console.log("Scores:", scores);
    console.log("Top issues:");
    for (const issue of failedAudits.slice(0, 5)) {
      const pct = issue.score != null ? Math.round(issue.score * 100) : "N/A";
      console.log(
        `  - [${issue.id}] ${issue.title} (${pct}/100)` +
          (issue.displayValue ? ` – ${issue.displayValue}` : "")
      );
    }

    return {
      route,
      url,
      scores,
      failedAudits, // full list in case you want to inspect later
    };
  } finally {
    await chrome.kill();
  }
}

/**
 * Main runner
 */
async function run() {
  await ensureOutDir();

  const summary = [];

  for (const route of ROUTES) {
    const res = await runLighthouseForRoute(route);
    summary.push({
      route: res.route,
      url: res.url,
      scores: res.scores,
      // store only a small subset of issues in the summary file
      topIssues: res.failedAudits.slice(0, 10),
    });
  }

  const summaryPath = path.join(OUT_DIR, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  console.log(`\nWrote summary to: ${summaryPath}`);
  console.log(`Individual HTML/JSON reports in: ${OUT_DIR}`);
}

// Allow both import and direct CLI usage
const invokedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export default run;
