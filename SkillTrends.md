## 🧭 Phase 2 — Advanced `SkillTrends` Design

Your **goal** here isn’t just to track “skill counts,” but to build a foundation for:

- Market demand insights
- Career recommendations
- Real-time dashboards
- Future machine learning (predictive demand)

We’ll aim for something scalable, query-efficient, and analyzable.

---

## 🧱 DynamoDB Table: `SkillTrends`

### 🔹 Primary Schema

| Attribute             | Type                                            | Description                                                  |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| **PK**                | `skill#<SkillName>`                             | Partition key (e.g. `skill#docker`)                          |
| **SK**                | `region#<Region>#seniority#<Level>`             | Sort key — enables multi-level aggregation queries           |
| **type**              | `technology` / `soft` / `framework` / `process` | Categorizes skill                                            |
| **count**             | number                                          | Total occurrences in job postings                            |
| **relativeDemand**    | number                                          | % of all postings containing this skill                      |
| **trendingDelta**     | number                                          | Change vs previous time window                               |
| **associatedRoles**   | string[]                                        | Common job titles                                            |
| **avgSalary**         | number                                          | Avg salary where skill appears                               |
| **cooccurringSkills** | map<string, number>                             | Other skills frequently appearing with this one              |
| **region**            | string                                          | Region code (e.g. `US`, `IL`, `CA`, `Remote`)                |
| **seniorityLevel**    | string                                          | Extracted from title: `junior`, `mid`, `senior`, `lead`      |
| **lastUpdated**       | string                                          | ISO timestamp                                                |
| **sourceCount**       | number                                          | Number of job postings scanned in this region-seniority pair |

---

### 🧩 GSI 1 — By Skill (Global View)

| Name   | `GSI1`              |
| ------ | ------------------- |
| **PK** | `skill#<SkillName>` |
| **SK** | `lastUpdated`       |

**Purpose:**
Quickly fetch the most recent snapshot of any skill across all regions/seniority levels.

**Example query:**

> “What’s the nationwide demand trend for Docker over the past 14 days?”

---

### 🧩 GSI 2 — Regional Demand

| Name   | `GSI2`               |
| ------ | -------------------- |
| **PK** | `region#<Region>`    |
| **SK** | `count` (descending) |

**Purpose:**
Top-demand skills per region (or for Remote).

**Example query:**

> “Show the top 10 skills in Illinois this week.”

---

### 🧩 GSI 3 — Seniority Trend

| Name   | `GSI3`               |
| ------ | -------------------- |
| **PK** | `seniority#<Level>`  |
| **SK** | `count` (descending) |

**Purpose:**
Compare demand patterns by career stage.

**Example query:**

> “Which skills are most common in senior roles nationwide?”

---

### 🧩 GSI 4 — Skill Co-occurrence Network

| Name   | `GSI4`                     |
| ------ | -------------------------- |
| **PK** | `skill#<SkillName>`        |
| **SK** | `cooccurring#<OtherSkill>` |

**Purpose:**
Analyze correlation between skills — build “people who learned this also learned that” graphs.

**Example query:**

> “What skills most often appear alongside Terraform?”

---

## ⚙️ Nightly Aggregation Flow (Lambda via EventBridge)

1. **Scan Jobs Table**

   - Pull all job postings from `JobsTable` created/updated in the last 24h.
   - Extract region, title (for seniority), and skills.

2. **Aggregate**

   - Count frequency by:

     - skill
     - region
     - seniority

3. **Calculate Derived Metrics**

   - `relativeDemand = skillCount / totalPostings`
   - `trendingDelta = (todayCount - avgPast7Days) / avgPast7Days`
   - `associatedRoles` = top N job titles
   - `cooccurringSkills` = pairwise frequency map per skill

4. **Update `SkillTrends`**

   - Use DynamoDB batch writes (possibly via streams or Step Functions if dataset grows).
   - Overwrite or upsert records keyed by (`skill#`, `region#seniority#`).

5. **Optionally: Store in S3 (Parquet/CSV) for Athena/QuickSight analysis.**

---

## 🧠 Bonus: Future-Proof Extensions

You can easily evolve this system with minimal schema drift:

| Future Feature               | Storage Pattern                                        |
| ---------------------------- | ------------------------------------------------------ |
| Historical time series       | Add a `timestamp` sort key per skill-region            |
| Skill clustering (embedding) | Store a small vector under `embedding`                 |
| Salary prediction            | Add `avgSalary`, `medianSalary`, `salaryTrend`         |
| Job type trends              | Include `employmentType` (full-time, contract, remote) |

---

## 🪄 Example Record

```json
{
  "PK": "skill#terraform",
  "SK": "region#US#seniority#senior",
  "type": "technology",
  "count": 482,
  "relativeDemand": 0.18,
  "trendingDelta": 0.07,
  "associatedRoles": ["DevOps Engineer", "Cloud Architect"],
  "avgSalary": 133000,
  "cooccurringSkills": {
    "aws": 398,
    "kubernetes": 354,
    "docker": 312
  },
  "region": "US",
  "seniorityLevel": "senior",
  "lastUpdated": "2025-10-05T07:00:00Z",
  "sourceCount": 2600
}
```

---

## 🧮 Why This Structure Works

- **Flexible** — can query any meaningful slice (skill, region, seniority)
- **Extensible** — you can add attributes (like embeddings, salary, trend windows)
- **Performant** — most access patterns are O(1) or O(log N) via GSIs
- **Analytics-ready** — structured to feed dashboards, ML, or even public APIs
