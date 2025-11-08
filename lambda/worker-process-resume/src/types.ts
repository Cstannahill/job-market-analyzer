export interface InsightsItem {
  resumeId: string;
  insightId: string;
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
  PK: string; //userId
  SK: string; //resumeId
  status: "pending" | "processed" | "failed";
  originalFileName: string;
  s3Key: string;
  contentType: string;
  uploadInitiatedAt: string;
  ttl: number;
}

export interface ResumeItem extends ResumeBaseItem {
  contactInfo: Record<string, any>;
  totalExperienceMonths?: number;
  totalExperienceLabel?: string;
  skills: string[];
  education?: any[];
  experience: Experience[];
  uploadedAt: string;
  updatedAt?: string;
}

export interface ResumeWithInsights extends ResumeItem {
  insightId: string;
  insightsText: any;
  insightsMetadata: {
    generatedAt: string;
    generatedBy: string;
  };
}

export interface Extractor {
  kind: "textract" | "ocr-fastapi";
  extract(input: { s3Key?: string; bytes?: Uint8Array }): Promise<{
    text: string;
    confidence?: number;
    blocks?: any[];
    costEstimateUSD?: number;
  }>;
}

// wiring
// env.EXTRACTOR_KIND = "ocr-fastapi" | "textract"
