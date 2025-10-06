⚙️ Step-by-Step Lambda Flow

1. Scan new job data

You’ll only want to aggregate recent or unprocessed jobs, so you might:

Track a createdAt or processed flag in each job record.

Filter createdAt > now - 24h.

const jobs = await ddb.scan({
TableName: "JobsTable",
FilterExpression: "#createdAt >= :yesterday",
ExpressionAttributeNames: { "#createdAt": "createdAt" },
ExpressionAttributeValues: { ":yesterday": Date.now() - 24 _ 60 _ 60 \* 1000 }
}).promise();

2. Aggregate skill data

We’ll bucket by (skill, region, seniority) and collect metrics.

interface SkillKey {
skill: string;
region: string;
seniority: string;
}

interface SkillAggregate {
count: number;
associatedRoles: Record<string, number>;
cooccurring: Record<string, number>;
salaries: number[];
}

const skillMap = new Map<string, SkillAggregate>();

for (const job of jobs.Items) {
const { skills = [], region = "Unknown", title, salary } = job;
const seniority = inferSeniority(title); // e.g. "junior", "senior", etc.

for (const skill of skills) {
const key = `${skill}::${region}::${seniority}`;
const entry = skillMap.get(key) ?? {
count: 0,
associatedRoles: {},
cooccurring: {},
salaries: []
};

    entry.count++;
    entry.associatedRoles[title] = (entry.associatedRoles[title] ?? 0) + 1;

    if (salary) entry.salaries.push(salary);

    // co-occurrence tracking
    for (const otherSkill of skills) {
      if (otherSkill !== skill)
        entry.cooccurring[otherSkill] =
          (entry.cooccurring[otherSkill] ?? 0) + 1;
    }

    skillMap.set(key, entry);

}
}

3. Compute derived metrics

We’ll enrich with averages and trends.

const totalPostings = jobs.Count ?? 1;

const updates = Array.from(skillMap.entries()).map(([key, agg]) => {
const [skill, region, seniority] = key.split("::");

const avgSalary = agg.salaries.length
? agg.salaries.reduce((a, b) => a + b, 0) / agg.salaries.length
: null;

return {
skill,
region,
seniority,
count: agg.count,
relativeDemand: agg.count / totalPostings,
associatedRoles: Object.entries(agg.associatedRoles)
.sort(([, a], [, b]) => b - a)
.slice(0, 5)
.map(([r]) => r),
cooccurringSkills: Object.fromEntries(
Object.entries(agg.cooccurring)
.sort(([, a], [, b]) => b - a)
.slice(0, 5)
),
avgSalary,
lastUpdated: new Date().toISOString(),
};
});

4. Batch write to SkillTrends
   import { DynamoDB } from "aws-sdk";
   const ddb = new DynamoDB.DocumentClient();

const BATCH_SIZE = 25;
for (let i = 0; i < updates.length; i += BATCH_SIZE) {
const chunk = updates.slice(i, i + BATCH_SIZE);

const request = {
RequestItems: {
SkillTrends: chunk.map((item) => ({
PutRequest: {
Item: {
PK: `skill#${item.skill.toLowerCase()}`,
SK: `region#${item.region.toLowerCase()}#seniority#${item.seniority.toLowerCase()}`,
...item,
},
},
})),
},
};

await ddb.batchWrite(request).promise();
}

5. (Optional) Export to S3 for Analytics

If you want to make this data queryable via Athena/QuickSight:

import { S3 } from "aws-sdk";
const s3 = new S3();

await s3.putObject({
Bucket: "job-trends-exports",
Key: `daily-trends/${new Date().toISOString().split("T")[0]}.json`,
Body: JSON.stringify(updates, null, 2),
ContentType: "application/json",
}).promise();

6. Helper: Infer Seniority
   function inferSeniority(title: string): string {
   const t = title.toLowerCase();
   if (t.includes("junior") || t.includes("associate")) return "junior";
   if (t.includes("senior") || t.includes("lead") || t.includes("principal")) return "senior";
   return "mid";
   }

7. Deploy and Schedule

You can deploy via AWS SAM, CDK, or Serverless Framework — whichever you’re using.

Example EventBridge rule (via console or IaC):

ScheduleExpression: "cron(0 5 \* _ ? _)"
State: "ENABLED"
