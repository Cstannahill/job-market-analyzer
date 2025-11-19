import type {
  ContactInfo,
  FlatSkills,
  IsoDateString,
  ResumeEducationItem,
  ResumeExperienceItem,
} from "./resume-record.js";

export type InsightAchievement = {
  headline: string;
  metric?: string | number | null;
  suggestedBullet: string;
};

export type InsightResumeEdits = {
  titleAndSummary?: { headline?: string; professionalSummary?: string };
  improvedBullets?: { old?: string | null; new: string }[];
};

export type EducationItem = {
  name?: string;
  degree?: string;
  fieldOfStudy?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  location?: string;
};

export type Insights = {
  summary?: { oneLine?: string; threeLine: string };
  strengths?: {
    text: string;
    why: string;
    confidence: "high" | "medium" | "low";
  }[];
  gaps?: {
    missing: string;
    impact: string;
    suggestedLearningOrAction: string;
    priority: "high" | "medium" | "low";
  }[];
  skills?: {
    technical?: { name: string; level?: string; evidenceLine?: string }[];
    soft?: { name: string; evidenceLine?: string }[];
  };
  topRoles?: { title: string; why: string; fitScore?: number }[];
  achievements?: InsightAchievement[];
  resumeEdits?: InsightResumeEdits;
  atsAndFormat?: { isATSFriendly?: boolean; recommendations?: string[] };
  confidence?: "high" | "medium" | "low";
  assumptions?: string[];
};

export type ExperienceItem = {
  title?: string;
  company?: string;
  location?: string;
  duration?: string;
};

export type SkillsItem = {
  technologies?: string[];
  softSkills?: string[];
  reasoning?: string;
};

export type AnalysisPayload = {
  resumeId?: string;
  contactInfo?: { email?: string; phone?: string | null };
  skills?: SkillsItem;
  education?: EducationItem[];
  experience?: ExperienceItem[];
  insights?: Insights;
};

export type CompareResult = {
  analysis?: AnalysisPayload;
  experience?: ResumeExperienceItem[];
  insightId?: string;
  insights?: Insights | undefined;
  status?: "processing" | "complete" | "failed";
  error?: string | undefined;
  insightsText?: string;
  insightsMetadata?: {
    generatedAt: IsoDateString;
    generatedBy: string;
  };
  uploadInitiatedAt?: IsoDateString;
  uploadedAt?: IsoDateString;
  updatedAt?: IsoDateString;
  contentType?: string;
  originalFileName?: string;
  contactInfo?: ContactInfo;
  education?: ResumeEducationItem[];
  PK?: string;
  SK?: string;
  s3Key?: string;
  skills?: FlatSkills;
};
