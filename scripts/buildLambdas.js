// build-lambdas.js

import { execSync } from "child_process";

const lambdaDirectories = [
  "aggregate-skill-trends-v2",
  "auth/auth-forgot-password",
  "auth/auth-get-current-user",
  "auth/auth-login",
  "auth/auth-logout",
  "auth/auth-register",
  "auth/auth-reset-password",
  "auth/auth-verify-email",
  "calculate-job-stats",
  "cognito-post-confirmation",
  "compare-resume-id",
  "get-job-postings-paginated",
  "get-job-postings-paginated-neon",
  "get-job-postings-stats",
  "get-job-processing-status",
  "get-trends-v2",
  "get-user-resumes",
  "ingest-jobs",
  "normalize-tables",
  "openrouter-ai-enhancement-from-table",
  "resume-presigned-url",
  "worker-process-resume",
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
