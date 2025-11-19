// src/lib/runAdapters.ts
import { adapters } from "../adapters/index.js";
import type { CanonicalJobPosting } from "@job-market-analyzer/types/canonical-job";

export interface AdapterRunOptions {
  adapterNames: string[];
  companySlugs: string[];
  sinceISO?: string;
  maxPages?: number;
  log: (
    level: "info" | "warn" | "error" | "debug",
    msg: string,
    extra?: Record<string, unknown>
  ) => void;
}

export interface AdapterRunResult {
  fetched: CanonicalJobPosting[];
  perAdapter: {
    fetched: Record<string, number>;
    uniqueByHash: Record<string, number>;
    errors: Record<string, number>;
  };
}

// Filter out invalid company slugs (404s) before fetch
async function filterValidBoards(
  slugs: string[],
  adapter: "greenhouse" | "lever",
  log: (
    level: "info" | "warn" | "error" | "debug",
    msg: string,
    extra?: Record<string, unknown>
  ) => void
): Promise<string[]> {
  const base =
    adapter === "greenhouse"
      ? "https://boards-api.greenhouse.io/v1/boards"
      : "https://api.lever.co/v0/postings";

  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const url =
          adapter === "greenhouse"
            ? `${base}/${slug}/jobs?limit=1`
            : `${base}/${slug}?limit=1`;
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) return slug;
        log("debug", "slug rejected", { adapter, slug, status: res.status });
        return null;
      } catch (err) {
        log("debug", "slug check failed", {
          adapter,
          slug,
          error: String(err),
        });
        return null;
      }
    })
  );

  const valid = results.filter(Boolean) as string[];
  log("info", "slug filter complete", {
    adapter,
    before: slugs.length,
    after: valid.length,
  });
  return valid;
}

export async function runAdapters({
  adapterNames,
  companySlugs,
  sinceISO,
  maxPages = 5,
  log,
}: AdapterRunOptions): Promise<AdapterRunResult> {
  const fetched: CanonicalJobPosting[] = [];
  const perAdapter = {
    fetched: {} as Record<string, number>,
    uniqueByHash: {} as Record<string, number>,
    errors: {} as Record<string, number>,
  };

  for (const name of adapterNames) {
    const adapter = adapters[name];
    if (!adapter) {
      log("warn", "unknown adapter", { name });
      continue;
    }

    try {
      const t0 = Date.now();
      let rows: CanonicalJobPosting[] = [];

      if (name === "greenhouse" || name === "lever") {
        let slugs = companySlugs.length ? companySlugs : [];
        if (slugs.length > 0) {
          // Dynamically verify boards to avoid 404 noise
          slugs = await filterValidBoards(slugs, name, log);
        }

        if (slugs.length === 0) {
          log("warn", "no valid slugs remaining", { adapter: name });
          continue;
        }

        for (const company of slugs) {
          const part = await adapter.fetch({
            company,
            since: sinceISO,
            maxPages,
          });
          rows.push(...part);
        }
      } else {
        rows = await adapter.fetch({ since: sinceISO, maxPages });
      }

      fetched.push(...rows);
      const uniq = new Set(rows.map((r) => r.postingHash)).size;
      perAdapter.fetched[name] = (perAdapter.fetched[name] || 0) + rows.length;
      perAdapter.uniqueByHash[name] = uniq;

      log("info", "adapter fetched", {
        adapter: name,
        count: rows.length,
        uniqueByHash: uniq,
        ms: Date.now() - t0,
      });
    } catch (e: any) {
      perAdapter.errors[name] = (perAdapter.errors[name] || 0) + 1;
      log("error", "adapter fetch failed", {
        adapter: name,
        error: e?.message || String(e),
      });
    }
  }

  return { fetched, perAdapter };
}
