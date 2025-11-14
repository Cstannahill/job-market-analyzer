# Job Market Analyzer

This repository contains a small set of Node.js Lambda functions (in `lambda/`) and a React frontend used to analyze job postings and extract skills. The project is organized to be friendly for CI/CD and production packaging.

## Key components

- `lambda/` - One or more AWS Lambda function folders. Each contains a TypeScript source tree that builds to `dist/` and packaging scripts.
- `frontend/` - React + Vite frontend (TypeScript + Tailwind + shadcn components).
- `zip.js` - Root-level packaging script that zips up a target lambda folder into `lambda.zip` using `archiver` installed at the repository root. Designed to avoid installing `archiver` in every lambda folder.

> Current state: Phase 1 completed (packaging centralization, .gitignore cleanup, per-lambda archiver removal). The frontend UI visual polish work is in progress (see roadmap).

## What was done in Phase 1

- Added a root-level `zip.js` (CommonJS) that packages a target lambda directory (dist, node_modules, package.json) into `lambda.zip` in that target folder.
- Installed `archiver` at the repository root so packaging tooling is available centrally.
- Removed `archiver` from the per-lambda `devDependencies` and updated per-lambda `package` scripts to call the root script (`node ../../zip.js .`).
- Replaced lambda-local `zip.js` files (where present) with small shims that delegate to the root-level `zip.js` script.
- Updated `.gitignore` to ignore `**/*.zip`, `**/node_modules/`, `**/dist/`, and `**/package-lock.json` recursively.

This reduces per-lambda duplication and keeps packaging logic centralized for easier maintenance and consistent outputs.

## How to package a single lambda (local)

1. Build inside the lambda folder (or from the repo root via npm workspaces/commands):

```bash
# from within a lambda folder (e.g. lambda/get-job-postings)
npm run build
# then package using the root script (per-lambda package scripts are updated to do this):
npm run package
# or call the root packer directly from repo root:
node zip.js lambda/get-job-postings
```

2. A `lambda.zip` will be created inside the target lambda folder. `./.gitignore` is set to ignore zip files.

## How to package all lambdas (optional)

You can script this in CI or locally. A simple node or bash script can iterate `lambda/*` and call the root `zip.js` for each directory.

Example (bash):

```bash
for d in lambda/*; do
  if [ -d "$d" ]; then
    node ./zip.js "$d"
  fi
done
```

The repository includes `scripts/packageLambdas.js` which demonstrates packaging a selection of lambdas by calling `node zip.js lambda/<name>`.

## Lambdas included in this repository

The current `lambda/` directory contains the following function folders (each generally includes `src/`, `package.json`, and build scripts):

- `aggregate-skill-trends`
- `bedrock-ai-extractor`
- `calculate-job-stats`
- `clean-jobs-bucket`
- `compare-resume-id`
- `get-job-postings`
- `get-job-postings-paginated`
- `get-job-postings-stats`
- `get-skill-trends`
- `job-posting-aggregator`
- `resume-presigned-url`
- `skill-extractor-ai`

Refer to each lambda's `package.json` for the exact `build` and `package` commands used by that function.

## Recommended repo layout and conventions

- Each lambda folder structure:
  - `src/` TypeScript sources
  - `dist/` generated JS after build
  - `package.json` with `build` and `package` scripts
  - `node_modules/` produced locally during build (ignored by git)
- Centralized packaging via root `zip.js` that inspects `dist/`, `node_modules/`, and `package.json` in the target folder and creates `lambda.zip`.

## CI / CD recommendations

- Centralize packaging step in CI (GitHub Actions example):

  - Checkout repository
  - Setup Node
  - For each lambda: npm ci --prefix <lambda>, npm run build --prefix <lambda>, node ./zip.js <lambda>
  - Upload the resulting `lambda.zip` as a release artifact or push to S3

  * Use a CD job to deploy via AWS CLI or SDK (e.g., `aws lambda update-function-code --function-name <name> --zip-file fileb://lambda.zip`)

- Use `npm ci` (not `npm install`) in CI for deterministic installs.
- Prefer keeping `archiver` as a devDependency only at the top-level repository (we installed it at the root). If you switch to pnpm or yarn workspaces, adapt accordingly.

## Security and reproducibility

- Do not check commit or include private keys or AWS credentials in the repo. Use Secrets in CI.
- Use `npm ci` and lockfiles (`package-lock.json` or `pnpm-lock.yaml`) for reproducible builds. We currently ignore nested `package-lock.json` files in `.gitignore` to avoid committing generated lockfiles from nested installs — consider moving to monorepo tooling (workspaces) for multi-package consistency.

## Roadmap / Phase 2 (recommended next work)

- Frontend polish & visual QA: finalize filter alignment, responsiveness, and accessibility (focus states). (In progress)
- Convert packaging to a small Node-based `pack-all` script and optionally integrate with a monorepo tool (pnpm/yarn workspaces) for consistent dependency management.
- Implement a GitHub Actions workflow that: runs tests, builds frontend, packages lambdas, uploads artifacts, and optionally deploys to a staging AWS account.
- (Optional) Migrate repository to ESM (`"type": "module"`) and convert Node scripts to ESM if desired — this is a broader change and should be planned.

## How to test locally (quick checklist)

- Build and package a lambda:
  - cd lambda/<name>
  - npm ci
  - npm run build
  - npm run package # invokes root zip.js
- Run frontend dev server:
  - cd frontend
  - npm install
  - npm run dev

## Frontend (React + Vite)

The frontend is a TypeScript React app built with Vite and Tailwind. It lives in `frontend/` and exposes a small dashboard for exploring job market trends, top technologies, job postings, and a resume upload analyzer.

Key pages (routes):

- `/` — Home landing page with quick stats and CTAs (`src/App.tsx`, `src/pages/Home.tsx`).
- `/trends` — Trends explorer with a left-hand skill list and an insights panel (charts, co-occurrence, trend history). (`src/pages/Trends.tsx`, `src/components/trends/*`).
- `/top-tech` — Simple visual list / bars of top technologies (`src/pages/TopTech.tsx`, `src/components/topTech/TopTechChart.tsx`).
- `/postings` — Job postings viewer and paginated posting list (`src/pages/Postings.tsx`, components under `src/components/postings`).
- `/resume` — Upload a resume (PDF/DOCX), get an AI-powered analysis and suggestions (`src/pages/UploadResume.tsx`, `src/components/resume/ResumeUploader.tsx`, `src/services/resumeService.ts`).

Frontend features discovered:

- Trends list + detail panel: fetches top skills and skill detail from `/trends` endpoints; includes sparkline/line charts, co-occurrence bar charts, CSV export and clipboard copy.
- Top Tech view: renders most in-demand technologies with animated bars and SVG badges.
- Job Postings: robust parsing of backend responses with helpers for messy shapes; supports paginated fetch (`getJobPostingsPage`).
- Resume upload: drag & drop or file picker; client-side validation (PDF/DOCX, max 10MB); uploads call `resumeService` which talks to backend/Amplify for direct S3 upload and analysis; UI shows progress, result summary, downloadable JSON, and copy-to-clipboard.
- React Query is used throughout for data fetching and caching (`@tanstack/react-query`).
- Charts use `recharts` and animations via `framer-motion`.
- Test helpers: a ResizeObserver mock and helpers are included to make Recharts work in jsdom tests (see `frontend/README.md` and `src/test-utils/resize.ts`).

Environment variables

- `VITE_API_URL` — Base URL for the deployed API Gateway (must include stage, e.g. `https://.../prod`). The frontend constructs requests to routes like `${VITE_API_URL}/trends/technology` or `${VITE_API_URL}/job-postings`.

How to run (frontend)

1. Install deps and start dev server:

```bash
cd frontend
npm install
npm run dev
```

2. Build for production:

```bash
cd frontend
npm run build
```

3. Tests and e2e:

- Unit tests (vitest):

```bash
cd frontend
npm run test        # interactive
npm run test:run    # run and exit
npm run test:coverage
```

- E2E / screenshots: Playwright scripts are in `frontend/e2e/`.
  - `npm run e2e:screens` will run the `e2e/trends.run.mjs` screenshot runner.
  - `npm run e2e:with-dev` runs a helper `run-with-dev.js` that starts the dev server and runs tests.

Important files and where to look for features

- `frontend/src/services/trendsService.ts` — API client + normalization for trends endpoints.
- `frontend/src/services/jobStatsService.ts` — consolidates stats used on the homepage and Top Tech view.
- `frontend/src/components/trends/*` — Skill list, SkillCard, SkillDetailPanel (charts, CSV export, copy).
- `frontend/src/components/topTech/TopTechChart.tsx` — Top technologies UI.
- `frontend/src/components/resume/ResumeUploader.tsx` — Resume upload UI and integration with `resumeService`.
- `frontend/src/components/postings/UpdatedJobsPostings.tsx` — Job postings list UI.

Notes and recommendations

- The frontend expects the API to return either raw arrays or Lambda-proxy shaped responses. The services include helpers to normalize both shapes.
- Keep `VITE_API_URL` configured in `frontend/.env` during local development to point at a staging or mocked API.
- The repository includes a `frontend/dist/` folder (likely built output); you may want to remove that from source control if it was committed by accident.

## Questions & notes for PR reviewers

- We intentionally installed `archiver` at the repo root to centralize packaging. I removed `archiver` from lambda `devDependencies`. If any lambda needs to run packaging isolated (no repo root), it will need archiver installed locally — which is not recommended for duplication.

---

## Architecture (target / completed system)

The diagram below shows the intended production architecture for the _completed_ Job Market Analyzer system (aggregation, resume comparison, scheduled ingestion, and dashboard delivery). This reflects the full design described in `JobMarketAnalyzer.md` and the Phase 1 implementation status noted above.

```mermaid
graph TB
    subgraph "Data Sources"
        Muse[The Muse API]
        Adzuna[Adzuna API]
        User[User Upload]
    end

    subgraph "Ingestion Layer"
        Scraper[Job Scraper Lambda<br/>Scheduled: 6h]
        S3Jobs[S3: Job Postings<br/>JSON Files]
    end

    subgraph "Processing Layer"
        RegexExtract[Skill Extractor<br/>Regex-based<br/>Trigger: S3 Upload]
        LLMEnrich[LLM Enrichment<br/>DeepSeek v3.1<br/>Scheduled: Hourly]
        Aggregator[Trends Aggregator<br/>Scheduled: Daily]
    end

    subgraph "Storage Layer"
        DBJobs[(JobPostings<br/>Basic Data)]
        DBEnriched[(JobPostingsEnriched<br/>LLM Analysis)]
        DBTrends[(SkillTrends<br/>Aggregated Metrics)]
    end

    subgraph "API Layer"
        API[API Gateway]
        GetJobs[Get Jobs Lambda]
        GetTrends[Get Trends Lambda]
    end

    subgraph "Presentation"
        Dashboard[React Dashboard<br/>Amplify Hosted]
    end

    Muse --> Scraper
    Adzuna --> Scraper
    Scraper --> S3Jobs
    S3Jobs --> RegexExtract
    S3Jobs --> LLMEnrich

    RegexExtract --> DBJobs
    LLMEnrich --> DBEnriched
    DBEnriched --> Aggregator
    Aggregator --> DBTrends

    Dashboard --> API
    API --> GetJobs
    API --> GetTrends
    GetJobs --> DBJobs
    GetTrends --> DBTrends

    classDef lambdaStyle fill:#fef3c7,stroke:#333,color:#000
    classDef llmStyle fill:#e0e7ff,stroke:#333,color:#000
    classDef frontendStyle fill:#9fdfbf,stroke:#333,color:#000

    class Scraper,RegexExtract,Aggregator,GetJobs,GetTrends lambdaStyle
    class LLMEnrich llmStyle
    class Dashboard frontendStyle
```

```mermaid
flowchart LR
  subgraph Ingest
    A[S3: postings-bucket] -->|ObjectCreated| IngestLambda[Lambda: Skill Extractor Regex]
    Scraper[Scraper Lambda] -->|pushes files| A
  end

  IngestLambda --> DynamoDBJobs[(DynamoDB: JobPostings)]

  subgraph LLM_Enrichment
    EventBridge1[EventBridge: hourly] -->|triggers| EnrichLambda[Lambda: LLM Enrichment]
    EnrichLambda -->|reads| A
    EnrichLambda -->|OpenRouter API| LLM[DeepSeek v3.1]
    EnrichLambda --> DynamoDBEnriched[(DynamoDB: JobPostingsEnriched)]
  end

  subgraph Aggregation
    EventBridge2[EventBridge: daily] -->|triggers| AggregatorLambda[Lambda: Trends Aggregator]
    AggregatorLambda --> DynamoDBEnriched
    AggregatorLambda --> DynamoDBTrends[(DynamoDB: SkillTrends)]
  end

  subgraph Comparison
    UploadResume[User uploads resume] --> ResumeS3[S3: resumes-bucket]
    ResumeS3 -->|ObjectCreated| ResumeLambda[Lambda: Resume Extractor]
    ResumeLambda --> Textract[Textract]
    ResumeLambda --> DynamoDBCandidates[(DynamoDB: CandidateProfile)]
    APICompare[API: /compare] --> CompareLambda[Lambda: Compare]
    CompareLambda --> DynamoDBTrends
    CompareLambda --> DynamoDBCandidates
  end

  subgraph UI
    WebApp[React + Amplify] -->|API calls| API[API Gateway]
    API -->|/job-postings| ReadJobsLambda[Lambda: Get Jobs]
    API -->|/trends/*| ReadTrendsLambda[Lambda: Get Trends]
    ReadJobsLambda --> DynamoDBJobs
    ReadTrendsLambda --> DynamoDBTrends
  end

  subgraph Storage
    DynamoDBJobs
    DynamoDBEnriched
    DynamoDBTrends
    DynamoDBCandidates
  end

  Monitoring[CloudWatch Logs] -.-> IngestLambda
  Monitoring -.-> EnrichLambda
  Monitoring -.-> AggregatorLambda
  Monitoring -.-> ResumeLambda
  Monitoring -.-> ReadJobsLambda
  Monitoring -.-> ReadTrendsLambda

  style A fill:#f9f,stroke:#333,stroke-width:1px
  style UI fill:#9fdfbf
  style Aggregation fill:#fef3c7
  style Comparison fill:#cfe8ff
  style Storage fill:#fff0f6
  style LLM_Enrichment fill:#e0e7ff
```

Notes:

- The diagram intentionally shows the full pipeline: ingestion, extraction (Textract + Comprehend), storage (DynamoDB), aggregation/trends, resume comparison, and the web dashboard.
- API Gateway fronts read/compare Lambdas for the frontend. EventBridge triggers scheduled aggregation.
- Components like CloudFront/Amplify and IAM roles, KMS keys, and VPC placement (if needed) are implied; include them in infra IaC as required.

## Repository tree (high-level)

This tree shows how the code maps to the architecture above. It represents the intended, completed layout (phase-complete):

```
/ (repo root)
├─ README.md
├─ JobMarketAnalyzer.md
├─ zip.js                # repo-level packaging script (creates lambda.zip)
├─ package.json          # root devDependencies (archiver, build tooling)
├─ lambda/
│  ├─ get-job-postings/
│  │  ├─ src/            # TypeScript sources for ingestion lambda
│  │  ├─ dist/           # build output (ignored)
│  │  └─ package.json    # scripts: build, package -> node ../../zip.js .
│  ├─ skill-extractor/
│  │  ├─ src/            # extraction logic (Comprehend integration)
│  │  ├─ dist/
│  │  └─ package.json
│  ├─ skill-extractor-algo/
│  │  ├─ src/            # optional alternate algorithmic extractor
│  │  ├─ dist/
│  │  └─ package.json
│  └─ ... other lambdas
├─ frontend/
│  ├─ src/               # React + shadcn components, pages
│  ├─ public/
│  ├─ package.json
│  └─ vite.config.ts
└─ .gitignore
```

Mapping notes:

- `lambda/*/src` implements the Lambdas shown in the diagram (ingest, aggregator, resume extractor, read APIs).
- `frontend/` is the React dashboard served through Amplify or CloudFront.
- `zip.js` is the centralized packer used by per-lambda `package` scripts.

## Updated Tree

```bash
npx tree-node-cli -I ".github|.vscode|node_modules|assets|icons|public|dist|packages|package-lock.json"
```

```
/job-market-analyzer
├── README.md
├── frontend
│   ├── README.md
│   ├── components.json
│   ├── e2e
│   │   ├── run-with-dev.js
│   │   ├── screenshot-all.mjs
│   │   ├── trends.run.mjs
│   │   └── trends.spec.mjs
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── scripts
│   │   ├── screenshot.js
│   │   └── trends-parse-test.mjs
│   ├── src
│   │   ├── App.tsx
│   │   ├── components
│   │   │   ├── AnimatedCounter.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── HeaderAlt.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   ├── Nav.tsx
│   │   │   ├── ParticleBackground.tsx
│   │   │   ├── Seo.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   ├── about
│   │   │   │   ├── FeatureCard.tsx
│   │   │   │   ├── FeatureHero.tsx
│   │   │   │   ├── PipelineTimeline.tsx
│   │   │   │   ├── RoadmapGrid.tsx
│   │   │   │   ├── SectionCard.tsx
│   │   │   │   └── StackPanel.tsx
│   │   │   ├── landing
│   │   │   │   ├── LandingCTA.tsx
│   │   │   │   ├── LandingHero.tsx
│   │   │   │   └── LandingPage.tsx
│   │   │   ├── login
│   │   │   │   └── LoginForm.tsx
│   │   │   ├── postings
│   │   │   │   ├── JobPostingCard.tsx
│   │   │   │   ├── JobPostingsControls.tsx
│   │   │   │   ├── JobPostingsSection.tsx
│   │   │   │   ├── MetaPillContainer.tsx
│   │   │   │   ├── TechBadge.tsx
│   │   │   │   ├── TechBadgeSvgr.tsx
│   │   │   │   └── UpdatedJobsPostings.tsx
│   │   │   ├── register
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── resume
│   │   │   │   ├── ResumeExperience.tsx
│   │   │   │   ├── ResumeInsights.tsx
│   │   │   │   ├── ResumeSummary.tsx
│   │   │   │   ├── ResumeTechnologies.tsx
│   │   │   │   └── ResumeUploader.tsx
│   │   │   ├── shared
│   │   │   │   ├── AuthCard.tsx
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   └── StatsCard.tsx
│   │   │   ├── topTech
│   │   │   │   └── TopTechChart.tsx
│   │   │   ├── trends
│   │   │   │   ├── SkillCard.test.tsx
│   │   │   │   ├── SkillCard.tsx
│   │   │   │   ├── SkillCardAlt.tsx
│   │   │   │   ├── SkillDetailPanel.test.tsx
│   │   │   │   ├── SkillDetailPanel.tsx
│   │   │   │   ├── SkillList.test.tsx
│   │   │   │   ├── SkillList.tsx
│   │   │   │   ├── SkillListOld.tsx
│   │   │   │   └── trends.test.ts
│   │   │   └── ui
│   │   │       ├── badge.tsx
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── field.tsx
│   │   │       ├── input.tsx
│   │   │       ├── label.tsx
│   │   │       ├── select.tsx
│   │   │       ├── separator.tsx
│   │   │       ├── sheet.tsx
│   │   │       ├── skeleton.tsx
│   │   │       ├── spinner.tsx
│   │   │       └── typography.tsx
│   │   ├── contexts
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── hooks
│   │   │   ├── useAuthInitialization.ts
│   │   │   ├── useIsMobile.ts
│   │   │   └── useTheme.ts
│   │   ├── index.css
│   │   ├── lib
│   │   │   ├── postingsBadgeHelpers.ts
│   │   │   ├── stringHelpers.ts
│   │   │   └── utils.ts
│   │   ├── main.tsx
│   │   ├── pages
│   │   │   ├── About.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Postings.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── TopTech.tsx
│   │   │   ├── Trends.tsx
│   │   │   ├── UploadResume.tsx
│   │   │   └── VerifyEmail.tsx
│   │   ├── services
│   │   │   ├── authService.ts
│   │   │   ├── jobPostingsService.ts
│   │   │   ├── jobStatsService.ts
│   │   │   ├── resumeService.ts
│   │   │   └── trendsService.ts
│   │   ├── setupTests.ts
│   │   ├── shared-types
│   │   │   ├── index.ts
│   │   │   └── src
│   │   │       ├── jobs.ts
│   │   │       ├── lambda.ts
│   │   │       ├── resume.ts
│   │   │       └── trends.ts
│   │   ├── stores
│   │   │   ├── authStore.ts
│   │   │   └── useJobPostingsStore.ts
│   │   ├── styles
│   │   │   ├── App.css
│   │   │   ├── JobPostingCard.css
│   │   │   ├── ParticleBackground.css
│   │   │   ├── auth.css
│   │   │   ├── cta.css
│   │   │   ├── feature-cards.css
│   │   │   ├── general.css
│   │   │   ├── icon-svg.css
│   │   │   ├── job-postings.css
│   │   │   ├── landing.css
│   │   │   ├── mobile-insights.css
│   │   │   ├── nav.css
│   │   │   ├── pagination.css
│   │   │   ├── remote-pill.css
│   │   │   ├── resume.css
│   │   │   ├── section-card.css
│   │   │   ├── stats-cards.css
│   │   │   ├── tech-bar.css
│   │   │   ├── tech-chart.css
│   │   │   ├── tokens.css
│   │   │   └── trends.css
│   │   ├── test-typings.d.ts
│   │   ├── test-utils
│   │   │   └── resize.ts
│   │   └── types
│   │       └── mermaid.d.ts
│   ├── tests
│   │   └── about.test.tsx
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── vitest.config.ts
├── lambda
│   ├── aggregate-skill-trends
│   │   ├── README.md
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── auth-get-current-user
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── auth-login
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── auth-logout
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── auth-register
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── auth-verify-email
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── bedrock-ai-extractor
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── calculate-job-stats
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── index.ts
│   │   │   └── jobs.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── clean-jobs-bucket
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── cognito-post-confirmation
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── compare-resume-id
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── aiService.ts
│   │   │   ├── calibrator.ts
│   │   │   ├── cors.ts
│   │   │   ├── dbService.ts
│   │   │   ├── docx.ts
│   │   │   ├── extractors.ts
│   │   │   ├── fileProcessor.ts
│   │   │   ├── index.ts
│   │   │   ├── preflight.ts
│   │   │   ├── s3Service.ts
│   │   │   ├── sanitizers.ts
│   │   │   └── types.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── compare-resume-id.zip
│   ├── get-job-postings
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── get-job-postings-paginated
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── get-job-postings-stats
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── get-skill-trends
│   │   ├── README.md
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── get-user-resumes
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── cors.ts
│   │   │   ├── index.ts
│   │   │   └── preflight.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── ingest-jobs
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── samconfig.toml
│   │   ├── src
│   │   │   ├── adapters
│   │   │   │   ├── greenhouse.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── lever.ts
│   │   │   │   ├── muse.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── usajobs.ts
│   │   │   ├── company-slugs.json
│   │   │   ├── index.ts
│   │   │   ├── lib
│   │   │   │   ├── dedupe.test.ts
│   │   │   │   ├── dedupe.ts
│   │   │   │   ├── devFilter.ts
│   │   │   │   ├── runAdapters.ts
│   │   │   │   └── upsert.ts
│   │   │   └── scripts
│   │   │       ├── discover-lever.ts
│   │   │       ├── find-boards.ts
│   │   │       └── smoke.ts
│   │   ├── template.yaml
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── job-posting-aggregator
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── adapters.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── normalize-tables
│   │   ├── package.json
│   │   ├── src
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── resume-presigned-url
│   │   ├── lambda.zip
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── dynamoService.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── skill-extractor-ai
│       ├── lambda.zip
│       ├── package.json
│       ├── src
│       │   └── index.ts
│       ├── tsconfig.json
│       └── tsup.config.ts
├── output.json
├── package.json
├── scripts
│   ├── buildLambdas.js
│   ├── packageLambdas.js
│   ├── playwright
│   ├── skillsandtech.py
│   └── status.py
└── zip.js
```

```json
{
  "technologies": [
    {
      "canonical": "TypeScript",
      "aliases": [],
      "category": "language",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Full-stack developer with 3 years of experience building applications and APIs in TypeScript",
          "char_start": 40,
          "char_end": 51
        }
      ],
      "notes": "Explicitly mentioned in the summary"
    },
    {
      "canonical": "JavaScript",
      "aliases": [],
      "category": "language",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Skilled across React, Next.js, and modern backend frameworks such as FastAPI and .NET Core.",
          "char_start": 52,
          "char_end": 67
        }
      ],
      "notes": "Implied by usage in React and Next.js"
    },
    {
      "canonical": "Python",
      "aliases": [],
      "category": "language",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Full-stack developer with 3 years of experience building applications and APIs in TypeScript, C#, and Python.",
          "char_start": 52,
          "char_end": 73
        }
      ],
      "notes": "Explicitly mentioned in the summary"
    },
    {
      "canonical": "C#",
      "aliases": ["CSharp"],
      "category": "language",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Skilled across React, Next.js, and modern backend frameworks such as FastAPI and .NET Core.",
          "char_start": 52,
          "char_end": 74
        }
      ],
      "notes": "Implied by usage in .NET Core"
    },
    {
      "canonical": "React",
      "aliases": [],
      "category": "framework",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Skilled across React, Next.js, and modern backend frameworks such as FastAPI and .NET Core.",
          "char_start": 52,
          "char_end": 58
        }
      ],
      "notes": "Explicitly mentioned in the summary"
    },
    {
      "canonical": "Next.js",
      "aliases": [],
      "category": "framework",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Skilled across React, Next.js, and modern backend frameworks such as FastAPI and .NET Core.",
          "char_start": 59,
          "char_end": 66
        }
      ],
      "notes": "Explicitly mentioned in the summary"
    },
    {
      "canonical": "FastAPI",
      "aliases": [],
      "category": "framework",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Skilled across React, Next.js, and modern backend frameworks such as FastAPI and .NET Core.",
          "char_start": 70,
          "char_end": 79
        }
      ],
      "notes": "Explicitly mentioned in the summary"
    },
    {
      "canonical": ".NET Core",
      "aliases": [".NET"],
      "category": "framework",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Skilled across React, Next.js, and modern backend frameworks such as FastAPI and .NET Core.",
          "char_start": 79,
          "char_end": 90
        }
      ],
      "notes": "Explicitly mentioned in the summary"
    },
    {
      "canonical": "PostgreSQL",
      "aliases": ["PG", "Postgres"],
      "category": "database",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Used PostgreSQL (Prisma ORM) and Inngest for background processing.",
          "char_start": 188,
          "char_end": 201
        }
      ],
      "notes": "Explicitly mentioned in the experience section"
    },
    {
      "canonical": "AWS",
      "aliases": [],
      "category": "cloud",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Architected serverless data pipeline processing 1000+ job postings daily using AWS Lambda, EventBridge, DynamoDB, and S3",
          "char_start": 220,
          "char_end": 223
        }
      ],
      "notes": "Explicitly mentioned in the experience section"
    },
    {
      "canonical": "Docker",
      "aliases": [],
      "category": "devops",
      "confidence": 1,
      "evidence": [
        {
          "quote": "DevOps & Systems: Linux (Ubuntu, WSL2), Docker, Bash, Zsh, GitHub Actions, IaC (SAM, CDK)",
          "char_start": 380,
          "char_end": 386
        }
      ],
      "notes": "Explicitly mentioned in the technical skills section"
    },
    {
      "canonical": "Git",
      "aliases": [],
      "category": "tooling",
      "confidence": 1,
      "evidence": [
        {
          "quote": "Dev Tools: Git, GitHub, GitHub CLI, Postman, Vite, npm, pnpm, pip, VS Code, curl, jq",
          "char_start": 406,
          "char_end": 409
        }
      ],
      "notes": "Explicitly mentioned in the technical skills section"
    },
    {
      "canonical": "Linux",
      "aliases": [],
      "category": "devops",
      "confidence": 1,
      "evidence": [
        {
          "quote": "DevOps & Systems: Linux (Ubuntu, WSL2), Docker, Bash, Zsh, GitHub Actions, IaC (SAM, CDK)",
          "char_start": 387,
          "char_end": 392
        }
      ],
      "notes": "Explicitly mentioned in the technical skills section"
    }
  ],
  "soft_skills": [
    {
      "name": "agile ceremonies",
      "confidence": 1,
      "evidence": [
        {
          "quote": "daily standups, weekly retrospectives, basic sprint planning",
          "char_start": 410,
          "char_end": 424
        }
      ],
      "notes": "Mentioned in the technical skills section"
    },
    {
      "name": "cross-functional collaboration",
      "confidence": 0.9,
      "evidence": [
        {
          "quote": "Mentored peers and contributed to business-critical projects during the program.",
          "char_start": 560,
          "char_end": 580
        }
      ],
      "notes": "Inferred from bootcamp experience"
    }
  ],
  "stack_combinations": [
    {
      "name": "React + TypeScript + AWS",
      "components": ["React", "TypeScript", "AWS"],
      "primary_use": "full-stack web app",
      "evidence": [
        {
          "quote": "Developed React + TypeScript dashboard with authentication (AWS Cognito)",
          "char_start": 200,
          "char_end": 215
        }
      ],
      "rationale": "Explicitly used together in a project",
      "confidence": 1
    },
    {
      "name": "Next.js + FastAPI + PostgreSQL",
      "components": ["Next.js", "FastAPI", "PostgreSQL"],
      "primary_use": "full-stack web app",
      "evidence": [
        {
          "quote": "Built with Next.js 15 (App Router) and FastAPI for structured document parsing.",
          "char_start": 280,
          "char_end": 300
        }
      ],
      "rationale": "Explicitly used together in a project",
      "confidence": 1
    }
  ],
  "inferences": {
    "probable_roles": ["Full-Stack Engineer"],
    "seniority_signals": ["led team"],
    "domains": ["web development"],
    "evidence": [
      {
        "quote": "Full-stack developer with 3 years of experience",
        "char_start": 30,
        "char_end": 47
      }
    ]
  },
  "reasoning": "Based on the combination of technologies and roles mentioned in the resume."
}
```

````



# id name

    8e0f3b84-0112-4c45-9164-50624b36ff73	Docker

1 e743962c-028c-4f6c-87e0-15502f583887 TypeScript
2 509fa552-b11f-4a2d-ace1-0d41e0f8a382 PostgreSQL
3 b86de665-7467-4891-95e6-65dd9d112a27 React
4 43524566-f57d-48dc-bec3-e2cf8d60e74a Node.js
5 07fc61f4-895d-4675-a4e1-4bec494405a8 Go
6 ed8bc5cb-95ad-4958-a65f-90b4b35cfe9d Kubernetes
7 48a77c94-f51b-47e0-b975-a99eb13f42b1 React Native
8 792689ac-c25c-46b4-9fb5-757f44393d30 MySQL
1 cafe3ad1-48af-4a5f-a28f-f1bad7ab2263 AWS
2 2c069c99-8a13-42d4-9d2a-d0a0c2f34e40 GCP
3 e68a6b14-737b-4d98-929b-80ca17494d7a Azure


```json
const input = { // ConverseRequest
  modelId: "STRING_VALUE", // required
  messages: [ // Messages
    { // Message
      role: "user" || "assistant", // required
      content: [ // ContentBlocks // required
        { // ContentBlock Union: only one key present
          text: "STRING_VALUE",
          image: { // ImageBlock
            format: "png" || "jpeg" || "gif" || "webp", // required
            source: { // ImageSource Union: only one key present
              bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
              s3Location: { // S3Location
                uri: "STRING_VALUE", // required
                bucketOwner: "STRING_VALUE",
              },
            },
          },
          document: { // DocumentBlock
            format: "pdf" || "csv" || "doc" || "docx" || "xls" || "xlsx" || "html" || "txt" || "md",
            name: "STRING_VALUE", // required
            source: { // DocumentSource Union: only one key present
              bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
              s3Location: {
                uri: "STRING_VALUE", // required
                bucketOwner: "STRING_VALUE",
              },
              text: "STRING_VALUE",
              content: [ // DocumentContentBlocks
                { // DocumentContentBlock Union: only one key present
                  text: "STRING_VALUE",
                },
              ],
            },
            context: "STRING_VALUE",
            citations: { // CitationsConfig
              enabled: true || false, // required
            },
          },
          video: { // VideoBlock
            format: "mkv" || "mov" || "mp4" || "webm" || "flv" || "mpeg" || "mpg" || "wmv" || "three_gp", // required
            source: { // VideoSource Union: only one key present
              bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
              s3Location: {
                uri: "STRING_VALUE", // required
                bucketOwner: "STRING_VALUE",
              },
            },
          },
          toolUse: { // ToolUseBlock
            toolUseId: "STRING_VALUE", // required
            name: "STRING_VALUE", // required
            input: "DOCUMENT_VALUE", // required
            type: "server_tool_use",
          },
          toolResult: { // ToolResultBlock
            toolUseId: "STRING_VALUE", // required
            content: [ // ToolResultContentBlocks // required
              { // ToolResultContentBlock Union: only one key present
                json: "DOCUMENT_VALUE",
                text: "STRING_VALUE",
                image: {
                  format: "png" || "jpeg" || "gif" || "webp", // required
                  source: {//  Union: only one key present
                    bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
                    s3Location: {
                      uri: "STRING_VALUE", // required
                      bucketOwner: "STRING_VALUE",
                    },
                  },
                },
                document: {
                  format: "pdf" || "csv" || "doc" || "docx" || "xls" || "xlsx" || "html" || "txt" || "md",
                  name: "STRING_VALUE", // required
                  source: {//  Union: only one key present
                    bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
                    s3Location: {
                      uri: "STRING_VALUE", // required
                      bucketOwner: "STRING_VALUE",
                    },
                    text: "STRING_VALUE",
                    content: [
                      {//  Union: only one key present
                        text: "STRING_VALUE",
                      },
                    ],
                  },
                  context: "STRING_VALUE",
                  citations: {
                    enabled: true || false, // required
                  },
                },
                video: {
                  format: "mkv" || "mov" || "mp4" || "webm" || "flv" || "mpeg" || "mpg" || "wmv" || "three_gp", // required
                  source: {//  Union: only one key present
                    bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
                    s3Location: "<S3Location>",
                  },
                },
              },
            ],
            status: "success" || "error",
            type: "STRING_VALUE",
          },
          guardContent: { // GuardrailConverseContentBlock Union: only one key present
            text: { // GuardrailConverseTextBlock
              text: "STRING_VALUE", // required
              qualifiers: [ // GuardrailConverseContentQualifierList
                "grounding_source" || "query" || "guard_content",
              ],
            },
            image: { // GuardrailConverseImageBlock
              format: "png" || "jpeg", // required
              source: { // GuardrailConverseImageSource Union: only one key present
                bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
              },
            },
          },
          cachePoint: { // CachePointBlock
            type: "default", // required
          },
          reasoningContent: { // ReasoningContentBlock Union: only one key present
            reasoningText: { // ReasoningTextBlock
              text: "STRING_VALUE", // required
              signature: "STRING_VALUE",
            },
            redactedContent: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
          },
          citationsContent: { // CitationsContentBlock
            content: [ // CitationGeneratedContentList
              { // CitationGeneratedContent Union: only one key present
                text: "STRING_VALUE",
              },
            ],
            citations: [ // Citations
              { // Citation
                title: "STRING_VALUE",
                sourceContent: [ // CitationSourceContentList
                  { // CitationSourceContent Union: only one key present
                    text: "STRING_VALUE",
                  },
                ],
                location: { // CitationLocation Union: only one key present
                  web: { // WebLocation
                    url: "STRING_VALUE",
                    domain: "STRING_VALUE",
                  },
                  documentChar: { // DocumentCharLocation
                    documentIndex: Number("int"),
                    start: Number("int"),
                    end: Number("int"),
                  },
                  documentPage: { // DocumentPageLocation
                    documentIndex: Number("int"),
                    start: Number("int"),
                    end: Number("int"),
                  },
                  documentChunk: { // DocumentChunkLocation
                    documentIndex: Number("int"),
                    start: Number("int"),
                    end: Number("int"),
                  },
                },
              },
            ],
          },
        },
      ],
    },
  ],
  system: [ // SystemContentBlocks
    { // SystemContentBlock Union: only one key present
      text: "STRING_VALUE",
      guardContent: {//  Union: only one key present
        text: {
          text: "STRING_VALUE", // required
          qualifiers: [
            "grounding_source" || "query" || "guard_content",
          ],
        },
        image: {
          format: "png" || "jpeg", // required
          source: {//  Union: only one key present
            bytes: new Uint8Array(), // e.g. Buffer.from("") or new TextEncoder().encode("")
          },
        },
      },
      cachePoint: {
        type: "default", // required
      },
    },
  ],
  inferenceConfig: { // InferenceConfiguration
    maxTokens: Number("int"),
    temperature: Number("float"),
    topP: Number("float"),
    stopSequences: [ // NonEmptyStringList
      "STRING_VALUE",
    ],
  },
  toolConfig: { // ToolConfiguration
    tools: [ // Tools // required
      { // Tool Union: only one key present
        toolSpec: { // ToolSpecification
          name: "STRING_VALUE", // required
          description: "STRING_VALUE",
          inputSchema: { // ToolInputSchema Union: only one key present
            json: "DOCUMENT_VALUE",
          },
        },
        systemTool: { // SystemTool
          name: "STRING_VALUE", // required
        },
        cachePoint: "<CachePointBlock>",
      },
    ],
    toolChoice: { // ToolChoice Union: only one key present
      auto: {},
      any: {},
      tool: { // SpecificToolChoice
        name: "STRING_VALUE", // required
      },
    },
  },
  guardrailConfig: { // GuardrailConfiguration
    guardrailIdentifier: "STRING_VALUE", // required
    guardrailVersion: "STRING_VALUE", // required
    trace: "enabled" || "disabled" || "enabled_full",
  },
  additionalModelRequestFields: "DOCUMENT_VALUE",
  promptVariables: { // PromptVariableMap
    "<keys>": { // PromptVariableValues Union: only one key present
      text: "STRING_VALUE",
    },
  },
  additionalModelResponseFieldPaths: [ // AdditionalModelResponseFieldPaths
    "STRING_VALUE",
  ],
  requestMetadata: { // RequestMetadata
    "<keys>": "STRING_VALUE",
  },
  performanceConfig: { // PerformanceConfiguration
    latency: "standard" || "optimized",
  },
};
````
