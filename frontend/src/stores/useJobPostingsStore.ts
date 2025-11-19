import type { BaseJobListing } from "@job-market-analyzer/types";
import { create } from "zustand";

type State = {
  jobPostings: BaseJobListing[];
  totalCount?: number;
};

type Action = {
  setJobPostings: (jobPostings: BaseJobListing[]) => void;
};

export const useJobPostingsStore = create<State & Action>((set) => ({
  jobPostings: [],
  setJobPostings: (jobPostings) => set({ jobPostings }),
}));
