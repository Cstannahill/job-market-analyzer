/**
 * Smoke-run adapters locally (no Dynamo, no S3), print a summary akin to the Lambda.
 * Usage:
 *   pnpm smoke
 *   ADAPTERS=muse pnpm smoke
 *   ADAPTERS=greenhouse,lever COMPANY=vercel pnpm smoke
 *   USAJOBS_API_KEY=... ADAPTERS=usajobs pnpm smoke
 */

import "dotenv/config";
import { adapters } from "../adapters/index.js";
import type { CanonicalPosting } from "../adapters/types.js";
import { runAdapters } from "../lib/runAdapters.js";
import fs from "fs";
import path from "path";

const companySlugsPath = path.resolve("./src/company-slugs.json");
const companySlugs = JSON.parse(fs.readFileSync(companySlugsPath, "utf-8"));
const ALL_SLUGS = [
  ...(companySlugs.greenhouse || []),
  ...(companySlugs.lever || []),
];

type Summary = {
  runId: string;
  adapters: string[];
  perAdapter: {
    fetched: Record<string, number>;
    uniqueByHash: Record<string, number>;
    errors: Record<string, number>;
  };
  fetched: number;
  uniqueByHashTotal: number;
  ms: number;
};

const ADAPTERS = (process.env.ADAPTERS || "muse")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const COMPANY = process.env.COMPANY; // used by greenhouse/lever
const MAX_PAGES = Number(process.env.MAX_PAGES || 3);

const log = (
  level: "info" | "warn" | "error" | "debug",
  msg: string,
  extra?: Record<string, unknown>
) => {
  console.log(
    JSON.stringify({ level, msg, ts: new Date().toISOString(), ...extra })
  );
};

async function main() {
  const runId = Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();
  log("info", "smoke start", { runId, adapters: ADAPTERS, company: COMPANY });

  const { fetched: all, perAdapter } = await runAdapters({
    adapterNames: ADAPTERS,
    companySlugs: COMPANY ? [COMPANY] : ALL_SLUGS,
    maxPages: MAX_PAGES,
    log,
  });

  const uniqueByHashTotal = new Set(all.map((r) => r.postingHash)).size;
  const ms = Date.now() - t0;

  const summary: Summary = {
    runId,
    adapters: ADAPTERS,
    perAdapter,
    fetched: all.length,
    uniqueByHashTotal,
    ms,
  };

  log("info", "smoke complete", summary as any);
  // Also print a pretty console line for humans
  console.log("\nSMOKE SUMMARY");
  console.table(perAdapter.fetched);
  console.table(perAdapter.uniqueByHash);
  console.log({
    fetched: summary.fetched,
    uniqueByHashTotal: summary.uniqueByHashTotal,
    ms: summary.ms,
  });
}

main().catch((err) => {
  log("error", "smoke fatal", { error: err?.message || String(err) });
  process.exit(1);
});
