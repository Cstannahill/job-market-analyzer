// build-lambdas.js

const { execSync } = require("child_process");

const lambdaDirectories = [
  "aggregate-skill-trends",
  "bedrock-ai-extractor",
  "calculate-job-stats",
  "clean-jobs-bucket",
  "get-job-postings",
  "get-job-postings-paginated",
  "get-job-postings-stats",
  "get-skill-trends",
  "job-posting-aggregator",
  "scrape-agl",
  "scrape-blt-wth",
  "scrape-gls-dr",
  "scrape-stack-ofj",
  "skill-extractor",
  "skill-extractor-ai",
  "skill-extractor-algo",
];

function buildLambdas() {
  console.log("Starting All Lambda Builds...");
  for (const dir of lambdaDirectories) {
    console.log(`\n============================================`);
    console.log(`🔨 Building: ${dir}`);
    console.log(`============================================`);
    try {
      // 1. Install dependencies
      console.log(`-> Running npm install in lambda/${dir}`);
      execSync("npm install", { stdio: "inherit", cwd: `lambda/${dir}` });

      // 2. Run tsup build
      console.log(`-> Running npx tsup src in lambda/${dir}`);
      // Note: cwd sets the Current Working Directory for the command
      execSync("npx tsup src", { stdio: "inherit", cwd: `lambda/${dir}` });

      console.log(`✅ Successfully built ${dir}`);
    } catch (error) {
      console.error(`❌ Error building ${dir}:`);
      process.exit(1); // Exit with error code if any build fails
    }
  }
  console.log("\n✨ All Lambdas successfully built!");
}

buildLambdas();
