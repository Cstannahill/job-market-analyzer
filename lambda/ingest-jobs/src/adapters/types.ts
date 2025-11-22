import type { CanonicalJobPosting } from "@job-market-analyzer/types/canonical-job";

export interface SourceAdapter {
  name: CanonicalJobPosting["source"];
  termsUrl: string;
  robotsOk: boolean;
  fetch(opts: {
    page?: number;
    company?: string;
    since?: string;
    maxPages?: number;
  }): Promise<CanonicalJobPosting[]>;
}
