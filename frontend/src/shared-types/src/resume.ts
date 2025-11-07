export type InsightAchievement = {
  headline: string;
  metric?: string | null;
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
  summary?: { oneLine?: string; "3line"?: string };
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
  skills?: {
    technologies?: string[];
    softSkills?: string[];
    reasoning?: string;
  };
  education?: EducationItem[];
  experience?: ExperienceItem[];
  insights?: Insights;
};

export type CompareResult = {
  analysis?: AnalysisPayload;
  // Backwards compatibility (if your backend sometimes returns top-level fields)
  skills?: { technologies?: string[]; softSkills?: string[] } | undefined;
  experience?: ExperienceItem[] | undefined;
  insights?: Insights | undefined;
  status?: "processing" | "complete" | "failed";
  error?: string | undefined;
};
type ContactInfo = {
  phone?: string;
  email?: string;
};

export interface ResumeWithInsights {
  id: string;
  userId: string;
  contactInfo: ContactInfo;
  contentType: string;
}
