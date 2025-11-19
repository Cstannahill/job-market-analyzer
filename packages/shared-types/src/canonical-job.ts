export interface CanonicalJobPosting {
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
  location: {
    city?: string;
    region?: string;
    country?: string;
    raw?: string;
  };
  postedDate?: string;
  description?: string;
  skills?: string[];
}
