import axios from "axios";
import * as cheerio from "cheerio";
import { SourceAdapter, CanonicalPosting } from "./types.js";
import { hashFromProviderFields, descSig } from "../lib/dedupe.js";
import { isDevRole } from "../lib/devFilter.js";

const MUSE_API_KEY = process.env.MUSE_API_KEY || "";
const BASE = "https://www.themuse.com/api/public/jobs";

// The Muse fields we care about
type MuseJob = {
  id: number;
  name: string; // title
  locations: Array<{ name: string }>;
  contents: string; // html
  publication_date?: string; // ISO
  company?: { name?: string };
};

async function fetchPage(
  page: number
): Promise<{ results: MuseJob[]; page_count: number }> {
  const params = {
    page,
    api_key: MUSE_API_KEY,
    category: [
      "Software Engineer",
      "Software Engineering",
      "Design and UX",
      "Data Science",
      "Data and Analytics",
    ],
  };
  const res = await axios.get(BASE, { params, timeout: 15000 });
  const data = res.data || {};
  return { results: data.results || [], page_count: data.page_count || 0 };
}

function stripHtmlToText(html: string | undefined): string {
  const raw = html ?? "";
  try {
    const $ = cheerio.load(String(raw));
    return $("body").text().replace(/\s+/g, " ").trim();
  } catch {
    return String(raw)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export const museAdapter: SourceAdapter = {
  name: "muse",
  termsUrl: "https://www.themuse.com/terms-of-use",
  robotsOk: true,
  async fetch({ maxPages = 50, since }) {
    const out: CanonicalPosting[] = [];
    const sinceTs = since ? Date.parse(since) : 0;

    const first = await fetchPage(0);
    const totalPages = Math.min(first.page_count, maxPages);

    const mapJob = (j: MuseJob): CanonicalPosting | null => {
      if (!isDevRole(j.name)) return null; // dev filter
      if (
        sinceTs &&
        j.publication_date &&
        Date.parse(j.publication_date) < sinceTs
      )
        return null;

      const locationRaw = j.locations?.[0]?.name || "";
      const text = stripHtmlToText(j.contents);
      const h = hashFromProviderFields({
        company: j.company?.name || "",
        title: j.name,
        locationRaw,
        postedDate: j.publication_date,
      });

      return {
        postingHash: h.postingHash,
        descriptionSig: descSig(text),
        source: "muse",
        sourceType: "api",
        termsUrl: this.termsUrl,
        robotsOk: this.robotsOk,
        fetchedAt: new Date().toISOString(),
        originalUrl: `https://www.themuse.com/jobs/${j.id}`,
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
      };
    };

    const add = (jobs: MuseJob[]) => {
      for (const j of jobs) {
        const mapped = mapJob(j);
        if (mapped) out.push(mapped);
      }
    };

    add(first.results);
    for (let p = 1; p < totalPages; p++) {
      try {
        await new Promise((r) => setTimeout(r, 100));
        const page = await fetchPage(p);
        add(page.results);
      } catch (e) {
        console.warn("[muse] page fetch failed", p, e);
      }
    }
    return out;
  },
};
