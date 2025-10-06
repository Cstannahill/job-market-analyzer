import { describe, it, expect } from "vitest";
import { normalizeRow } from "./trends";

describe("trends.normalizeRow", () => {
  it("parses a spring boot sample", () => {
    const row = {
      PK: "skill#spring boot",
      SK: "region#us#seniority#senior",
      associatedRoles: "[]",
      avgSalary: "122800",
      cooccurringSkills:
        '{"spring":{"N":"1"},"fuse":{"N":"1"},"java":{"N":"1"}}',
      count: "1",
      lastUpdated: "2025-10-05T23:17:04.508Z",
      region: "us",
      relativeDemand: "0.02",
      remotePercentage: "0",
      seniority_level: "senior",
      skill: "spring boot",
      skill_type: "soft_skill",
      topIndustries: '[{"S":"IT consulting"}]',
    } as any;

    const parsed = normalizeRow(row);
    expect(parsed.skill).toBe("spring boot");
    expect(parsed.avgSalary).toBe(122800);
    expect(parsed.cooccurringSkills.spring).toBe(1);
    expect(parsed.topIndustries).toEqual(["IT consulting"]);
    expect(parsed.remotePercentage).toBe(0);
  });

  it("handles null salary and empty maps", () => {
    const row = {
      PK: "skill#bamboo",
      SK: "region#unknown#seniority#senior",
      avgSalary: "null",
      cooccurringSkills: "{}",
      topIndustries: "[]",
      count: "1",
      region: "unknown",
      relativeDemand: "0.02",
      remotePercentage: "0",
      seniority_level: "senior",
      skill: "bamboo",
      skill_type: "soft_skill",
    } as any;

    const parsed = normalizeRow(row);
    expect(parsed.avgSalary).toBeNull();
    expect(parsed.cooccurringSkills).toEqual({});
    expect(parsed.topIndustries).toEqual([]);
  });
});
