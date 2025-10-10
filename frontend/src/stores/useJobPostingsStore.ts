import type { ExtendedJobPosting } from "@/services/api";
import { create } from "zustand";

type State = {
  jobPostings: ExtendedJobPosting[];
  totalCount?: number;
};

type Action = {
  setJobPostings: (jobPostings: ExtendedJobPosting[]) => void;
};

export const useJobPostingsStore = create<State & Action>((set) => ({
  jobPostings: [],
  setJobPostings: (jobPostings) => set({ jobPostings }),
}));
