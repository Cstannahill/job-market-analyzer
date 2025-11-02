export interface SourceAdapter {
  name: "muse" | "greenhouse" | "lever" | "usajobs";
  termsUrl: string;
  robotsOk: boolean;
  fetch(opts: {
    page?: number;
    company?: string;
    since?: string;
  }): Promise<Array<JobPosting>>;
}

export type JobPosting = {
  postingHash: string;
  source: string;
  sourceType: "api" | "rss" | "json";
  termsUrl: string;
  robotsOk: boolean;
  fetchedAt: string;
  originalUrl: string;
  company: string;
  title: string;
  location: string;
  postedDate?: string;
  description?: string;
  skills?: string[];
};

type CanonicalPosting = {
  postingHash: string; // from makeHash()
  source: "seed" | "muse" | "greenhouse" | "lever" | "usajobs";
  sourceType: "api" | "rss" | "json" | "seed";
  termsUrl?: string;
  robotsOk?: boolean;
  fetchedAt: string; // ISO
  originalUrl?: string;

  company: string; // canonicalized
  title: string; // canonicalized
  location: { city?: string; region?: string; country?: string; raw?: string };
  postedDate?: string; // YYYY-MM-DD
  description?: string;

  skills?: string[]; // normalized tokens if you have them
};
