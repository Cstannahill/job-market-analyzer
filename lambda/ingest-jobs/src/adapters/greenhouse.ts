import { SourceAdapter, CanonicalPosting } from "./types.js";
import { hashFromProviderFields, descSig } from "../lib/dedupe.js";
import { isDevRole } from "../lib/devFilter.js";

async function fetchCompany(company: string): Promise<any[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`;
  const res = await fetch(url, {
    headers: { "user-agent": "JMA/1.0 (+contact)" },
  });
  if (!res.ok) throw new Error(`Greenhouse ${company} ${res.status}`);
  const data = await res.json();
  return data.jobs ?? [];
}

export const greenhouseAdapter: SourceAdapter = {
  name: "greenhouse",
  termsUrl: "https://www.greenhouse.io/legal/terms",
  robotsOk: true,
  async fetch({ company, since }) {
    if (!company) return [];
    const sinceTs = since ? Date.parse(since) : 0;

    const out: CanonicalPosting[] = [];
    const jobs = await fetchCompany(company);

    for (const j of jobs) {
      if (!isDevRole(j.title || "")) continue;
      const updated = j.updated_at;
      if (sinceTs && updated && Date.parse(updated) < sinceTs) continue;

      const locationRaw = j.location?.name || "";
      const text = (j.content || "").toString().replace(/\s+/g, " ").trim();

      const h = hashFromProviderFields({
        company: j.company?.name || company,
        title: j.title,
        locationRaw,
        postedDate: updated,
      });

      out.push({
        postingHash: h.postingHash,
        descriptionSig: descSig(text),
        source: "greenhouse",
        sourceType: "api",
        termsUrl: this.termsUrl,
        robotsOk: this.robotsOk,
        fetchedAt: new Date().toISOString(),
        originalUrl: j.absolute_url,
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
