// package-lambdas.js

const { execSync } = require("child_process");
const path = require("path");

const lambdaDirectories = [
  "aggregate-skill-trends",
  "bedrock-ai-extractor",
  "calculate-job-stats",
  "clean-jobs-bucket",
  "compare-resume-id",
  "get-job-postings",
  "get-job-postings-paginated",
  "get-job-postings-stats",
  "get-skill-trends",
  "job-posting-aggregator",
  "resume-presigned-url",
  "process-resume",
  "scrape-agl",
  "scrape-blt-wth",
  "scrape-gls-dr",
  "scrape-stack-ofj",
  "skill-extractor",
  "skill-extractor-ai",
  "skill-extractor-algo",
];

function packageLambdas() {
  console.log("Starting Lambda Packaging...");
  for (const dir of lambdaDirectories) {
    const command = `node zip.js lambda/${dir}`;
    console.log(`\nExecuting: ${command}`);
    try {
      execSync(command, { stdio: "inherit" });
      console.log(`✅ Successfully packaged ${dir}`);
    } catch (error) {
      console.error(`❌ Error packaging ${dir}:`);
      process.exit(1); // Exit with error code if any packaging fails
    }
  }
  console.log("\n✨ All Lambdas successfully packaged!");
}

packageLambdas();
