#!/usr/bin/env node
// Simple helper to start the Vite dev server, wait for it to be ready on port 5173,
// run the Playwright runner, then kill the dev server.
// Works when invoked from project root: `node ./e2e/run-with-dev.js` or via npm script.

import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function waitForUrl(url, timeout = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeout) {
            reject(new Error("Timed out waiting for " + url));
            return;
          }
          setTimeout(check, 250);
        });
    };
    check();
  });
}

(async () => {
  const dev = spawn("npm", ["run", "dev"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
  });

  const url = "http://localhost:5173/";
  try {
    console.log("Waiting for dev server...");
    await waitForUrl(url, 30000);
    console.log("Dev server is up — running Playwright runner");
    // run the playwright runner
    const runner = spawn(
      process.execPath,
      [path.resolve(__dirname, "trends.run.mjs")],
      {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
        shell: true,
      }
    );

    await new Promise((resolve, reject) => {
      runner.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error("Runner failed"))
      );
      runner.on("error", reject);
    });
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    // kill dev server
    if (dev && dev.pid) {
      try {
        process.kill(dev.pid, "SIGTERM");
      } catch (e) {
        // ignore
      }
    }
  }
})();
