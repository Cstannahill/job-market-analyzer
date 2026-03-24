// package-lambdas.js

import { execSync } from "child_process";
import path from "path";

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
