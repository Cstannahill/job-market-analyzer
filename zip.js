#!/usr/bin/env node
/*
 Root-level zip script (CommonJS)
 Usage: node zip.js <path-to-lambda-dir>
 Example: node zip.js lambda-functions/get-job-postings

 This script will create <target>/lambda.zip containing:
  - dist/ (if present)
  - node_modules/ (if present)
  - package.json (if present)

 The goal is to avoid having to install archiver inside each lambda function.
*/

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

function usageAndExit(msg) {
  if (msg) console.error(msg);
  console.log("Usage: node zip.js <lambda-dir>");
  process.exit(msg ? 1 : 0);
}

const arg = process.argv[2];
if (!arg) usageAndExit("Missing target lambda directory argument.");

const targetDir = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  usageAndExit(`Target directory not found or not a directory: ${targetDir}`);
}

const outputZip = path.join(targetDir, "lambda.zip");

function createZip() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZip);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(
        `Lambda zip created: ${archive.pointer()} bytes -> ${outputZip}`
      );
      resolve();
    });

    output.on("end", () => {
      console.log("Data has been drained");
    });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn("Archiver warning", err);
      } else {
        reject(err);
      }
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    function addIfExists(fsPath, entryName, isDirectory = false) {
      if (fs.existsSync(fsPath)) {
        if (isDirectory) {
          const dest = entryName === false ? "(root of zip)" : entryName;
          console.log(`Adding directory to zip: ${fsPath} -> ${dest}`);
          // If entryName === false, archiver will place the directory contents at the archive root
          archive.directory(fsPath, entryName);
        } else {
          console.log(`Adding file to zip: ${fsPath} -> ${entryName}`);
          archive.file(fsPath, { name: entryName });
        }
      } else {
        console.warn(`Skipping missing path: ${fsPath}`);
      }
    }

    const distPath = path.join(targetDir, "dist");
    const nodeModulesPath = path.join(targetDir, "node_modules");
    const packageJsonPath = path.join(targetDir, "package.json");

    // Add dist contents at the root of the zip (so files like index.js, package.json,
    // and node_modules/* from inside dist end up at the zip root rather than under a dist/ folder)
    addIfExists(distPath, false, true);
    addIfExists(nodeModulesPath, "node_modules", true);
    addIfExists(packageJsonPath, "package.json", false);

    archive.finalize().catch(reject);
  });
}

createZip().catch((err) => {
  console.error("Failed to create zip:", err);
  process.exitCode = 1;
});
