import { normalizeRow } from "../src/services/trends.js";

const samples = [
  {
    PK: "skill#spring boot",
    SK: "region#us#seniority#senior",
    associatedRoles: "[]",
    avgSalary: "122800",
    cooccurringSkills: '{"spring":{"N":"1"},"fuse":{"N":"1"},"java":{"N":"1"}}',
    count: "1",
    lastUpdated: "2025-10-05T23:17:04.508Z",
    region: "us",
    relativeDemand: "0.02",
    remotePercentage: "0",
    seniority_level: "senior",
    skill: "spring boot",
    skill_type: "soft_skill",
    topIndustries: '[{"S":"IT consulting"}]',
  },
  {
    PK: "skill#azure",
    SK: "region#us#seniority#senior",
    associatedRoles: "[]",
    avgSalary: "262500",
    cooccurringSkills: '{"go":{"N":"1"},"python":{"N":"1"}}',
    count: "1",
    lastUpdated: "2025-10-05T23:17:04.508Z",
    region: "us",
    relativeDemand: "0.02",
    remotePercentage: "0",
    seniority_level: "senior",
    skill: "azure",
    skill_type: "soft_skill",
    topIndustries: '[{"S":"Healthcare"}]',
  },
];

for (const s of samples) {
  console.log(JSON.stringify(normalizeRow(s), null, 2));
}
