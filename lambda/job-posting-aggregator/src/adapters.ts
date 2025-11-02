import type { SourceAdapter } from "./types.js";

export const greenhouseAdapter: SourceAdapter = {
  name: "greenhouse",
  termsUrl: "https://www.greenhouse.io/legal/terms",
  robotsOk: true,
  async fetch({ company }) {
    if (!company) return [];
    const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { "user-agent": "JMA/1.0 (+contact)" },
    });
    const data = await res.json();
    return (data.jobs ?? []).map((j: any) => ({
      postingHash: makeHash(
        `${j.company?.name}|${j.title}|${
          j.location?.name
        }|${j.updated_at?.slice(0, 10)}`
      ),
      source: "greenhouse",
      sourceType: "api",
      termsUrl: "https://www.greenhouse.io/legal/terms",
      robotsOk: true,
      fetchedAt: new Date().toISOString(),
      originalUrl: j.absolute_url,
      company: j.company?.name ?? company,
      title: j.title,
      location: j.location?.name ?? "",
      postedDate: j.updated_at,
      description: j.content ?? "",
    }));
  },
};

export const leverAdapter: SourceAdapter = {
  name: "lever",
  termsUrl: "https://www.lever.co/terms-of-service/",
  robotsOk: true,
  async fetch({ company }) {
    if (!company) return [];
    const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
    const res = await fetch(url, {
      headers: { "user-agent": "JMA/1.0 (+contact)" },
    });
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((p: any) => ({
      postingHash: makeHash(
        `${company}|${p.text}|${p.categories?.location}|${
          p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : ""
        }`
      ),
      source: "lever",
      sourceType: "api",
      termsUrl: "https://www.lever.co/terms-of-service/",
      robotsOk: true,
      fetchedAt: new Date().toISOString(),
      originalUrl: p.hostedUrl,
      company,
      title: p.text,
      location: p.categories?.location ?? "",
      postedDate: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
      description: p.descriptionPlain ?? p.description ?? "",
    }));
  },
};

export const usajobsAdapter: SourceAdapter = {
  name: "usajobs",
  termsUrl: "https://www.usajobs.gov/Help/faq/account/policy/",
  robotsOk: true,
  async fetch({ page = 1 }) {
    const url = `https://data.usajobs.gov/api/search?ResultsPerPage=50&Page=${page}`;
    const res = await fetch(url, {
      headers: {
        Host: "data.usajobs.gov",
        "User-Agent": "JMA/1.0 (+contact)",
        "Authorization-Key": process.env.USAJOBS_API_KEY || "",
      },
    });
    const data = await res.json();
    const arr = data?.SearchResult?.SearchResultItems ?? [];
    return arr.map((it: any) => {
      const j = it.MatchedObjectDescriptor || {};
      return {
        postingHash: makeHash(
          `${j.OrganizationName}|${j.PositionTitle}|${
            j.PositionLocationDisplay
          }|${j.PublicationStartDate?.slice(0, 10)}`
        ),
        source: "usajobs",
        sourceType: "api",
        termsUrl: "https://www.usajobs.gov/Help/faq/account/policy/",
        robotsOk: true,
        fetchedAt: new Date().toISOString(),
        originalUrl: j.PositionURI,
        company: j.OrganizationName || "USA",
        title: j.PositionTitle,
        location: j.PositionLocationDisplay || "",
        postedDate: j.PublicationStartDate,
        description: j.UserArea?.Details?.JobSummary || "",
      };
    });
  },
};
