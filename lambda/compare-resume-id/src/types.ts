export interface InsightsItem {
  resumeId: string;
  insightsText: any;
  generatedAt: string;
  generatedBy: string;
}

export interface Experience {
  title?: string;
  company?: string;
  location?: string;
  duration?: string;
  description?: string[];
}
