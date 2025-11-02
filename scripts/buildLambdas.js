// build-lambdas.js

const { execSync } = require("child_process");

const lambdaDirectories = [
  "aggregate-skill-trends",
  "auth-get-current-user",
  "auth-login",
  "auth-logout",
  "auth-register",
  "auth-verify-email",
  "bedrock-ai-extractor",
  "bedrock-ai-enhancement-from-table",
  "calculate-job-stats",
  "clean-jobs-bucket",
  "cognito-post-confirmation",
  "compare-resume-id",
  "get-job-postings",
  "get-job-postings-paginated",
  "get-job-postings-stats",
  "get-user-resumes",
  "get-skill-trends",
  "ingest-jobs",
  "job-posting-aggregator",
  "resume-presigned-url",
  "skill-extractor-ai",
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
      console.log(`-> Running tsup src in lambda/${dir}`);

      // Note: cwd sets the Current Working Directory for the command
      execSync("tsup", { stdio: "inherit", cwd: `lambda/${dir}` });

      console.log(`✅ Successfully built ${dir}`);
    } catch (error) {
      console.error(`❌ Error building ${dir}:`);
      process.exit(1); // Exit with error code if any build fails
    }
  }
  console.log("\n✨ All Lambdas successfully built!");
}

buildLambdas();
