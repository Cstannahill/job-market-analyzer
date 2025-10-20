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

export interface ResumeBaseItem {
  PK: string;
  SK: string;
  status: "pending" | "processed" | "failed";
  originalFileName: string;
  s3Key: string;
  contentType: string;
  uploadInitiatedAt: string;
  ttl: number;
}
