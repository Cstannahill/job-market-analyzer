import { DynamoDBClient, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { adapters } from "./adapters/index.js";
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

const TABLE = mustEnv("JOBS_TABLE");
const ADAPTERS = (process.env.ADAPTERS || "muse")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SINCE_DAYS = Number(process.env.SINCE_DAYS || 14);
const COMPANY_SLUGS = process.env.COMPANY_SLUGS
  ? process.env.COMPANY_SLUGS.split(",").map((s) => s.trim())
  : ALL_SLUGS;

const sinceISO = new Date(
  Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000
).toISOString();

const ARCHIVE_BUCKET = process.env.ARCHIVE_S3_BUCKET || "";
const ARCHIVE_POLICY = (process.env.ARCHIVE_POLICY || "new") as
  | "none"
  | "new"
  | "changed"
  | "all";

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});

const log = (
  level: "info" | "warn" | "error" | "debug",
  msg: string,
  extra?: Record<string, unknown>
) => {
  const entry = { level, msg, ts: new Date().toISOString(), ...extra };

  console.log(JSON.stringify(entry));
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

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

  const hashes = fetched.map((x) => x.postingHash);
  const existMap = await batchGetExists(hashes);

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
