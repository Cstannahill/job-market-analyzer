import { SourceAdapter, CanonicalPosting } from "./types.js";
import { hashFromProviderFields, descSig } from "../lib/dedupe.js";
import { isDevRole } from "../lib/devFilter.js";

const KEY = process.env.USAJOBS_API_KEY || "";

async function fetchPage(page: number) {
  const url = `https://data.usajobs.gov/api/search?ResultsPerPage=50&Page=${page}`;
  const res = await fetch(url, {
    headers: {
      Host: "data.usajobs.gov",
      "User-Agent": "JMA/1.0 (+contact)",
      "Authorization-Key": KEY,
    },
  });
  if (!res.ok) throw new Error(`USAJOBS ${res.status}`);
  const data = await res.json();
  const items = data?.SearchResult?.SearchResultItems ?? [];
  return items;
}

export const usajobsAdapter: SourceAdapter = {
  name: "usajobs",
  termsUrl: "https://www.usajobs.gov/Help/faq/account/policy/",
  robotsOk: true,
  async fetch({ page = 1, maxPages = 2, since }) {
    const out: CanonicalPosting[] = [];
    const sinceTs = since ? Date.parse(since) : 0;

    for (let p = page; p < page + maxPages; p++) {
      try {
        const items = await fetchPage(p);
        for (const it of items) {
          const j = it.MatchedObjectDescriptor || {};
          if (!isDevRole(j.PositionTitle || "")) continue; // dev filter

          const pub = j.PublicationStartDate;
          if (sinceTs && pub && Date.parse(pub) < sinceTs) continue; // since filter

          const locationRaw = j.PositionLocationDisplay || "";
          const text = (j.UserArea?.Details?.JobSummary || "")
            .toString()
            .replace(/\s+/g, " ")
            .trim();

          const h = hashFromProviderFields({
            company: j.OrganizationName || "USA",
            title: j.PositionTitle,
            locationRaw,
            postedDate: pub,
          });

          out.push({
            postingHash: h.postingHash,
            descriptionSig: descSig(text),

            source: "usajobs",
            sourceType: "api",
            termsUrl: this.termsUrl,
            robotsOk: this.robotsOk,
            fetchedAt: new Date().toISOString(),
            originalUrl: j.PositionURI,

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
      } catch (e) {
        console.warn("[usajobs] page fetch failed", p, e);
      }
    }
    return out;
  },
};
