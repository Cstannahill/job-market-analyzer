export interface SkillTrend {
  id: string;
  pk: string;
  sk: string;
  skill: string;
  region: string;
  seniority: string;
  type?: string;
  count: number;
  relativeDemand?: number;
  remotePercentage?: number;
  avgSalary?: number | null;
  lastUpdated?: string;
  associatedRoles?: string[];
  cooccurringSkills?: Record<string, number>;
  topIndustries?: string[];
}
