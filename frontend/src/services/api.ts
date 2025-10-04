import axios from "axios";

// Replace this with your actual API Gateway URL
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod";

export interface JobPosting {
  Id: string;
  title: string;
  skills: string[];
  technologies: string[];
  raw_text: string;
  date: string;
  source_file: string;
}

export interface ApiResponse {
  success: boolean;
  count: number;
  data: JobPosting[];
}

/**
 * Fetch all job postings from the API
 */
export const getJobPostings = async (): Promise<JobPosting[]> => {
  try {
    const response = await axios.get(`${API_URL}/job-postings`);

    let data = response.data;

    // Check if data has statusCode (Lambda didn't use proxy integration properly)
    if (data.statusCode) {
      // Parse the body string
      data = JSON.parse(data.body);
    }

    if (data.success) {
      return data.data;
    }

    throw new Error("API returned unsuccessful response");
  } catch (error) {
    console.error("Full error:", error);
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch job postings"
      );
    }
    throw error;
  }
};

/**
 * Get unique technologies across all job postings
 */
export const getUniqueTechnologies = (jobPostings: JobPosting[]): string[] => {
  const techSet = new Set<string>();
  jobPostings.forEach((posting) => {
    posting.technologies.forEach((tech) => techSet.add(tech));
  });
  return Array.from(techSet).sort();
};

/**
 * Count technology occurrences
 */
export const getTechnologyCounts = (
  jobPostings: JobPosting[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  jobPostings.forEach((posting) => {
    posting.technologies.forEach((tech) => {
      counts[tech] = (counts[tech] || 0) + 1;
    });
  });
  return counts;
};
