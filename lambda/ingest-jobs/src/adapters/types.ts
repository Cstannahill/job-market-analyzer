export type CanonicalPosting = {
  postingHash: string;
  descriptionSig?: string;

  source: "muse" | "greenhouse" | "lever" | "usajobs" | "seed";
  sourceType: "api" | "rss" | "json" | "seed";
  termsUrl?: string;
  robotsOk?: boolean;
  fetchedAt: string;
  originalUrl?: string;

  company: string;
  title: string;
  location: { city?: string; region?: string; country?: string; raw?: string };
  postedDate?: string; // YYYY-MM-DD
  description?: string;
  // optional: skills?: string[]
};

export interface SourceAdapter {
  name: CanonicalPosting["source"];
  termsUrl: string;
  robotsOk: boolean;
  fetch(opts: {
    page?: number;
    company?: string;
    since?: string; // ISO date lower bound, adapter decides how to apply
    maxPages?: number;
  }): Promise<CanonicalPosting[]>;
}
