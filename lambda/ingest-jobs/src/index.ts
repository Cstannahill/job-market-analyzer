// ingest-jobs/src/index.ts
import { DynamoDBClient, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { adapters } from "./adapters/index.js"; // registry: muse, greenhouse, lever, usajobs
import type { CanonicalJobPosting } from "@job-market-analyzer/types/canonical-job";
import { upsertMerge } from "./lib/upsert.js";
import { runAdapters } from "./lib/runAdapters.js";
import fs from "fs";
import path from "path";

const companySlugsPath = path.resolve("./company-slugs.json");
const companySlugs = JSON.parse(fs.readFileSync(companySlugsPath, "utf-8"));
const ALL_SLUGS = [
  ...(companySlugs.greenhouse || []),
  ...(companySlugs.lever || []),
];
console.log("Loaded company slugs:", {
  greenhouse: companySlugs.greenhouse?.length || 0,
  lever: companySlugs.lever?.length || 0,
});
// ---------- env ----------
const TABLE = mustEnv("JOBS_TABLE");
const ADAPTERS = (process.env.ADAPTERS || "muse")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SINCE_DAYS = Number(process.env.SINCE_DAYS || 14);
const COMPANY_SLUGS = process.env.COMPANY_SLUGS
  ? process.env.COMPANY_SLUGS.split(",").map((s) => s.trim())
  : ALL_SLUGS; // fallback to our verified list

// compute since ISO for adapters that can use it
const sinceISO = new Date(
  Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000
).toISOString();

// optional S3 archiving (we only archive new/changed)
const ARCHIVE_BUCKET = process.env.ARCHIVE_S3_BUCKET || "";
const ARCHIVE_POLICY = (process.env.ARCHIVE_POLICY || "new") as
  | "none"
  | "new"
  | "changed"
  | "all"; // none|new|changed|all

// ---------- clients ----------
const ddb = new DynamoDBClient({});
const s3 = new S3Client({});

// ---------- structured logger (lightweight) ----------
const log = (
  level: "info" | "warn" | "error" | "debug",
  msg: string,
  extra?: Record<string, unknown>
) => {
  const entry = { level, msg, ts: new Date().toISOString(), ...extra };
  // CloudWatch is happy with JSON lines
  console.log(JSON.stringify(entry));
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

// Batch existence lookup for (PK,SK) pairs
async function batchGetExists(
  hashes: string[]
): Promise<Map<string, { descriptionSig?: string }>> {
  const out = new Map<string, { descriptionSig?: string }>();
  const uniqueHashes = [...new Set(hashes)];

  for (let i = 0; i < uniqueHashes.length; i += 100) {
    const chunk = uniqueHashes
      .slice(i, i + 100)
      .map((h) => ({ PK: { S: `JOB#${h}` }, SK: { S: "POSTING#v1" } }));
    const res = await ddb.send(
      new BatchGetItemCommand({ RequestItems: { [TABLE]: { Keys: chunk } } })
    );
    const rows = res.Responses?.[TABLE] || [];
    for (const item of rows) {
      const pk = item.PK.S!;
      const hash = pk.replace(/^JOB#/, "");
      const sig = (item as any).descriptionSig?.S as string | undefined;
      out.set(hash, { descriptionSig: sig });
    }
  }
  return out;
}

// Optional archive writer
async function archiveIfNeeded(
  p: CanonicalJobPosting,
  existed: boolean,
  oldSig?: string
) {
  if (!ARCHIVE_BUCKET || ARCHIVE_POLICY === "none") return false;
  const changed =
    existed && p.descriptionSig && oldSig && p.descriptionSig !== oldSig;
  const should =
    ARCHIVE_POLICY === "all" ||
    (ARCHIVE_POLICY === "new" && !existed) ||
    (ARCHIVE_POLICY === "changed" && changed);
  if (!should) return false;

  const key = `raw/${p.source}/${p.postedDate || "unknown"}/${
    p.postingHash
  }.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: ARCHIVE_BUCKET,
      Key: key,
      Body: Buffer.from(JSON.stringify(p), "utf8"),
      ContentType: "application/json",
    })
  );
  return true;
}

// Lambda entry
export const handler = async () => {
  const runId = Math.random().toString(36).slice(2, 8);
  const start = Date.now();
  log("info", "ingest start", { runId, adapters: ADAPTERS });

  const { fetched, perAdapter } = await runAdapters({
    adapterNames: ADAPTERS,
    companySlugs: COMPANY_SLUGS,
    sinceISO,
    maxPages: 10,
    log,
  });

  if (fetched.length === 0) {
    log("info", "no postings fetched; exiting", { runId });
    return {
      runId,
      fetched: 0,
      newOrChanged: 0,
      upserts: 0,
      archived: 0,
      perAdapter,
    };
  }

  // 2) Existence check (Dynamo) — dedupe-before-archive
  const hashes = fetched.map((x) => x.postingHash);
  const existMap = await batchGetExists(hashes);

  // 3) Split into new/changed vs existing
  const newOrChanged: CanonicalJobPosting[] = [];
  let unchanged = 0;

  for (const p of fetched) {
    const existing = existMap.get(p.postingHash);
    const isNew = !existing;
    const isChanged =
      !!existing &&
      !!p.descriptionSig &&
      existing.descriptionSig !== p.descriptionSig;
    if (isNew || isChanged) {
      newOrChanged.push(p);
    } else {
      unchanged++;
    }
  }

  // 4) Upsert + optional archive
  let upserts = 0,
    archived = 0;
  for (const p of newOrChanged) {
    await upsertMerge(ddb, TABLE, p);
    upserts++;
    const existed = existMap.has(p.postingHash);
    const oldSig = existMap.get(p.postingHash)?.descriptionSig;
    if (await archiveIfNeeded(p, existed, oldSig)) archived++;
  }

  const ms = Date.now() - start;
  log("info", "ingest complete", {
    runId,
    fetched: fetched.length,
    newOrChanged: newOrChanged.length,
    unchanged,
    upserts,
    archived,
    ms,
    perAdapter,
  });

  return {
    runId,
    fetched: fetched.length,
    newOrChanged: newOrChanged.length,
    unchanged,
    upserts,
    archived,
    ms,
    perAdapter,
  };
};
