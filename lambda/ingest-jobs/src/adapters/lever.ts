import { SourceAdapter } from "./types.js";
import type { CanonicalJobPosting } from "@job-market-analyzer/types/canonical-job";
import { hashFromProviderFields, descSig } from "../lib/dedupe.js";
import { isDevRole } from "../lib/devFilter.js";

async function fetchCompany(company: string): Promise<any[]> {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const res = await fetch(url, {
    headers: { "user-agent": "JMA/1.0 (+contact)" },
  });
  if (!res.ok) throw new Error(`Lever ${company} ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export const leverAdapter: SourceAdapter = {
  name: "lever",
  termsUrl: "https://www.lever.co/terms-of-service/",
  robotsOk: true,
  async fetch({ company, since }) {
    if (!company) return [];
    const sinceTs = since ? Date.parse(since) : 0;

    const out: CanonicalJobPosting[] = [];
    const postings = await fetchCompany(company);

    for (const p of postings) {
      const title = p.text || p.title || "";
      if (!isDevRole(title)) continue;

      const created = p.createdAt
        ? new Date(p.createdAt).toISOString()
        : undefined;
      if (sinceTs && created && Date.parse(created) < sinceTs) continue;

      const locationRaw = p.categories?.location || "";
      const text = (p.descriptionPlain || p.description || "")
        .toString()
        .replace(/\s+/g, " ")
        .trim();

      const h = hashFromProviderFields({
        company,
        title,
        locationRaw,
        postedDate: created,
      });

      out.push({
        postingHash: h.postingHash,
        descriptionSig: descSig(text),
        source: "lever",
        sourceType: "api",
        termsUrl: this.termsUrl,
        robotsOk: this.robotsOk,
        fetchedAt: new Date().toISOString(),
        originalUrl: p.hostedUrl,
        company: h.company,
        title: h.title,
        location: {
          city: h.city,
          region: h.region,
          country: h.country,
          raw: locationRaw,
        },
        postedDate: h.date,
        description: text,
      });
    }
    return out;
  },
};
