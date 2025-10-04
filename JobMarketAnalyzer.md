# Job Market Skill Analyzer for Job Seekers

## Pipeline

Job postings go into S3 (raw text).

Lambda + Textract/Comprehend → extract required skills, tools, qualifications.

Store normalized skill entities in DynamoDB.

Aggregate trends → "This month, top 5 sought skills: AWS Lambda, GraphQL, Docker, TypeScript, Terraform."

Add comparison feature: Upload your resume → pipeline runs same extraction → compare against aggregated job market demands.

Output dashboard:

Heatmap of skill match % vs market.

Recommendations: "Consider learning Terraform, appears in 62% of postings, you have 0 mentions."

Historical trending: "GraphQL demand up 25% over last 3 months."

AWS Stack Coverage:
✅ S3 (postings + resumes)
✅ Lambda (ETL jobs + comparisons)
✅ DynamoDB (normalized job/skill data)
✅ Comprehend (extract entities/skills)
✅ Textract (PDF/HTML parsing)
✅ CloudFront/Amplify (dashboard)
✅ EventBridge (scheduled scraping or job update events)

## Roadmap

### Phase 1: Skeleton MVP (Core Data Pipeline)

Set up ingestion bucket (S3)

Create job-postings-bucket for raw postings (JSON, HTML, or text files).

Start with manual uploads (no scraper yet).

Parse and extract skills

Lambda triggered on ObjectCreated in S3.

Use Comprehend to extract key phrases/entities.

Store cleaned data in DynamoDB (JobPostings table: posting_id, title, skills[], date).

Simple dashboard

Amplify or CloudFront + React frontend.

Fetch from DynamoDB via API Gateway + Lambda (read-only at this stage).

Display: job posting list + extracted skills.

✅ Complete

### Phase 2: Aggregation & Insights

Trend aggregation

Lambda batch job (triggered nightly via EventBridge).

Scan DynamoDB → calculate frequency of skills.

Store results in a SkillTrends table.

Comparison engine

Add a second upload bucket for resumes (resumes-bucket).

Lambda + Textract → extract text.

Comprehend → extract skills.

Store in CandidateProfile table.

Matchmaking API

Lambda endpoint compares CandidateProfile skills vs SkillTrends.

Returns gap analysis (skills to learn, current strengths, match %).

Now the app can say “You match 60% of current market skills. Top gaps: Terraform, GraphQL.”

### Phase 3: Extras / Polish

Scheduled job posting ingestion

Build a simple scraper (Python or Node) → push results into S3.

Automate with EventBridge (hourly/daily).

Sentiment analysis (optional)

Comprehend Sentiment API on job descriptions to detect positive/negative tone.

Could be fun for experimenting (e.g., “most postings for Rust have neutral tone, but AWS roles have demanding tone”).

Visualization

Use QuickSight or D3.js in frontend to show trends over time.
