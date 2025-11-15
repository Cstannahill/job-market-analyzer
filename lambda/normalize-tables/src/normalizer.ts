import { companiesMap } from "./companiesMap.js";
import {
  CompanySize,
  DynamoJobPosting,
  JobNeon,
  JobSource,
  NewCompanyRecord,
  NewIndustryRecord,
  NewSkillRecord,
  NewTechnologyRecord,
  NormalizedJobEntities,
  RemoteStatus,
  SeniorityLevel,
} from "./types.js";
import {
  coerceStringArray,
  normalizeWhitespace,
  nullIfEmpty,
  parseBooleanLike,
  parseSalaryRange,
  slugify,
  toTitleCase,
  uniqueCaseInsensitive,
} from "./utils.js";

type CompanyDirectory = Map<string, string>;

const GLOBAL_COMPANY_DIRECTORY: CompanyDirectory = new Map();
const SOURCE_COMPANY_DIRECTORY: Partial<Record<JobSource, CompanyDirectory>> =
  {};

const COMPANY_ALIASES: Array<{ canonical: string; variants: string[] }> = [
  {
    canonical: "Block",
    variants: ["Square", "Square Inc", "Square, Inc.", "Block (Square)"],
  },
  {
    canonical: "Meta",
    variants: ["Facebook", "Facebook Inc"],
  },
  {
    canonical: "Alphabet",
    variants: ["Google", "Google Inc", "Google LLC", "Alphabet Inc"],
  },
  {
    canonical: "Microsoft",
    variants: ["Microsoft Corporation", "Microsoft Corp"],
  },
  {
    canonical: "Amazon",
    variants: [
      "Amazon.com",
      "Amazon Web Services",
      "Amazon Web Services (AWS)",
    ],
  },
  {
    canonical: "Apple",
    variants: ["Apple Inc", "Apple, Inc."],
  },
  {
    canonical: "OpenAI",
    variants: ["Open Ai", "Openai"],
  },
  {
    canonical: "Anduril Industries",
    variants: ["Anduril", "Andurilindustries"],
  },
  {
    canonical: "Hudson River Trading",
    variants: ["HRT", "Hudson River Trading (HRT)"],
  },
  {
    canonical: "NVIDIA",
    variants: ["Nvidia", "Nvidia Corporation"],
  },
];

const COMPANY_SUFFIX_PATTERN =
  /\b(inc|inc\.|incorporated|corp|corp\.|corporation|co|co\.|company|companies|llc|l\.l\.c\.|ltd|ltd\.|limited|plc|gmbh|ag|sa|s\.a\.|bv|holding|holdings|group)\b\.?/gi;

function toCompanyKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function prettifyCompanySlug(slug: string): string {
  const normalized = slug.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "";
  return toTitleCase(normalized);
}

function registerCompany(directory: CompanyDirectory, name: string) {
  const key = toCompanyKey(name);
  if (!key) return;
  if (!directory.has(key)) {
    directory.set(key, name);
  }
  if (!GLOBAL_COMPANY_DIRECTORY.has(key)) {
    GLOBAL_COMPANY_DIRECTORY.set(key, name);
  }
}

function hydrateCompanyDirectories() {
  for (const [source, entries] of Object.entries(companiesMap)) {
    const sourceKey = source as JobSource;
    const directory: CompanyDirectory =
      SOURCE_COMPANY_DIRECTORY[sourceKey] ?? new Map();
    for (const entry of entries) {
      const canonical = prettifyCompanySlug(entry);
      if (canonical) {
        registerCompany(directory, canonical);
      }
    }
    SOURCE_COMPANY_DIRECTORY[sourceKey] = directory;
  }

  for (const entry of COMPANY_ALIASES) {
    registerCompany(GLOBAL_COMPANY_DIRECTORY, entry.canonical);
    for (const variant of entry.variants) {
      const key = toCompanyKey(variant);
      if (key && !GLOBAL_COMPANY_DIRECTORY.has(key)) {
        GLOBAL_COMPANY_DIRECTORY.set(key, entry.canonical);
      }
    }
  }
}

hydrateCompanyDirectories();

type TechnologyAlias = { canonical: string; variants: string[] };

const TECHNOLOGY_ALIASES: TechnologyAlias[] = [
  {
    canonical: "JavaScript",
    variants: ["js", "java script", "javascript", "vanilla js"],
  },
  { canonical: "TypeScript", variants: ["ts", "typescript", "type script"] },
  { canonical: "Node.js", variants: ["node", "nodejs", "node.js"] },
  { canonical: "React", variants: ["reactjs", "react.js", "react js"] },
  {
    canonical: "React Native",
    variants: ["reactnative", "react-native", "react native"],
  },
  { canonical: "Vue", variants: ["vuejs", "vue.js", "vue js"] },
  { canonical: "Angular", variants: ["angularjs", "angular.js", "angular js"] },
  { canonical: "Go", variants: ["golang", "go lang"] },
  { canonical: "C#", variants: ["c sharp", "csharp"] },
  { canonical: "C++", variants: ["c plus plus", "cplusplus", "cpp"] },
  { canonical: "Python", variants: ["python3", "python 3", "py"] },
  { canonical: "Django", variants: ["django framework"] },
  { canonical: "Flask", variants: ["flask framework"] },
  { canonical: "FastAPI", variants: ["fast api"] },
  { canonical: "Ruby on Rails", variants: ["rails", "ror", "ruby on rails"] },
  {
    canonical: "PostgreSQL",
    variants: ["postgres", "postgresql", "postgress"],
  },
  { canonical: "MySQL", variants: ["mysql database"] },
  { canonical: "MongoDB", variants: ["mongodb", "mongo db", "mongo"] },
  { canonical: "SQL Server", variants: ["mssql", "ms sql", "microsoft sql"] },
  { canonical: "AWS", variants: ["amazon web services", "amazon aws"] },
  { canonical: "GCP", variants: ["google cloud", "google cloud platform"] },
  { canonical: "Azure", variants: ["microsoft azure"] },
  { canonical: "Docker", variants: ["docker container", "docker containers"] },
  {
    canonical: "Kubernetes",
    variants: ["k8s", "kubernetes cluster", "kubernetes clusters"],
  },
  { canonical: "Terraform", variants: ["hashicorp terraform"] },
  { canonical: "Ansible", variants: ["ansible playbooks"] },
  { canonical: "Jenkins", variants: ["jenkins ci", "jenkins pipelines"] },
  { canonical: "GitHub", variants: ["github actions"] },
  { canonical: "GitLab", variants: ["gitlab ci", "gitlab pipelines"] },
  { canonical: "CI/CD", variants: ["ci", "cd", "ci cd", "cicd"] },
  { canonical: "REST", variants: ["restful", "rest api", "rest apis"] },
  { canonical: "GraphQL", variants: ["graphql api", "graphql apis"] },
  { canonical: "HTML", variants: ["html5"] },
  { canonical: "CSS", variants: ["css3"] },
  { canonical: "Sass", variants: ["scss", "sass/scss"] },
  { canonical: "Tailwind CSS", variants: ["tailwind", "tailwindcss"] },
  { canonical: "Next.js", variants: ["nextjs", "next js", "next"] },
  { canonical: "Nuxt", variants: ["nuxtjs", "nuxt.js"] },
  { canonical: "Svelte", variants: ["sveltekit", "svelte kit"] },
  { canonical: "Swift", variants: ["swiftui", "swift ui"] },
  { canonical: "Objective-C", variants: ["objective c", "objc"] },
  { canonical: "Kotlin", variants: ["kotlin coroutines"] },
  { canonical: "Android", variants: ["android sdk"] },
  { canonical: "iOS", variants: ["ios sdk", "ios development"] },
  { canonical: "PowerShell", variants: ["powershell scripting"] },
  { canonical: "Bash", variants: ["shell scripting", "bash scripting"] },
  { canonical: "Tableau", variants: ["tableau desktop", "tableau server"] },
  { canonical: "Snowflake", variants: ["snowflake db"] },
  { canonical: "Databricks", variants: ["databricks platform"] },
  { canonical: "Airflow", variants: ["apache airflow"] },
  { canonical: "Spark", variants: ["apache spark"] },
  { canonical: "Kafka", variants: ["apache kafka"] },
  { canonical: "Hadoop", variants: ["apache hadoop"] },
  { canonical: "Elasticsearch", variants: ["elastic search"] },
  { canonical: "Redis", variants: ["redis cache"] },
  { canonical: "RabbitMQ", variants: ["rabbit mq"] },
  { canonical: "Salesforce", variants: ["salesforce crm"] },
  { canonical: "ServiceNow", variants: ["servicenow platform"] },
];

const TECHNOLOGY_ALIAS_LOOKUP = new Map<string, string>();

function registerTechnologyAlias(value: string, canonical: string) {
  const normalized = normalizeWhitespace(value.toLowerCase());
  if (!normalized) return;
  if (!TECHNOLOGY_ALIAS_LOOKUP.has(normalized)) {
    TECHNOLOGY_ALIAS_LOOKUP.set(normalized, canonical);
  }
  const collapsed = normalized.replace(/\s+/g, "");
  if (collapsed && !TECHNOLOGY_ALIAS_LOOKUP.has(collapsed)) {
    TECHNOLOGY_ALIAS_LOOKUP.set(collapsed, canonical);
  }
}

for (const alias of TECHNOLOGY_ALIASES) {
  registerTechnologyAlias(alias.canonical.toLowerCase(), alias.canonical);
  for (const variant of alias.variants) {
    registerTechnologyAlias(variant, alias.canonical);
  }
}

const TECHNOLOGY_REGEX_RULES: Array<[RegExp, string]> = [
  [/^c\+\+(\s\d{2})?$/, "C++"],
  [/^(c#|csharp|c\s?sharp)$/, "C#"],
  [/^\.net(?:\s(core|framework))?$/, ".NET"],
  [/^aws\b/, "AWS"],
  [/^amazon\s+web\s+services$/, "AWS"],
  [/^google\s+cloud/, "GCP"],
  [/^microsoft\s+azure$/, "Azure"],
  [/^sql\s*server$/, "SQL Server"],
  [/^ms\s*sql$/, "SQL Server"],
  [/^postgres(?:ql)?$/, "PostgreSQL"],
  [/^mongo(?:db)?$/, "MongoDB"],
  [/^mysql$/, "MySQL"],
  [/^webpack$/, "Webpack"],
  [/^babel$/, "Babel"],
  [/^pytest$/, "PyTest"],
  [/^pytorch$/, "PyTorch"],
  [/^tensorflow$/, "TensorFlow"],
  [/^llms?$/, "LLM"],
  [/^machine\s+learning$/, "Machine Learning"],
  [/^artificial\s+intelligence$/, "Artificial Intelligence"],
  [/^data\s+science$/, "Data Science"],
  [/^big\s*data$/, "Big Data"],
  [/^sql$/, "SQL"],
];

const INDUSTRY_ALIASES: Record<string, string> = {
  it: "Information Technology",
  "information technology": "Information Technology",
  fintech: "Financial Technology",
  "financial services": "Financial Services",
  "health care": "Healthcare",
  healthcare: "Healthcare",
  biotech: "Biotechnology",
  "bio technology": "Biotechnology",
  ecommerce: "E-commerce",
  "e-commerce": "E-commerce",
  retail: "Retail",
  education: "Education",
  "higher education": "Education",
  manufacturing: "Manufacturing",
  aerospace: "Aerospace",
  defense: "Defense",
  "aerospace & defense": "Aerospace & Defense",
};

const COMPANY_SIZE_KEYWORDS: Array<[RegExp, CompanySize]> = [
  [/startup|early\s*stage|seed|pre[-\s]?seed|stealth|micro\b/, "startup"],
  [/small\s*(business|company)?|smb\b|1[-\s]?10\b/, "small"],
  [/mid(?:dle)?\s*(size|sized)?|scale[-\s]?up|11[-\s]?250/, "medium"],
  [/enterprise|global|fortune\s*500|1000\+|1000\s*employees/, "enterprise"],
  [/\b51[-\s]?200\b|\b201[-\s]?500\b/, "medium"],
  [/\b501[-\s]?1000\b/, "large"],
  [/\b1000[-\s]?5000\b|\b5001[-\s]?10000\b/, "large"],
  [/\b10000\+\b|\b10000[-\s]?/, "enterprise"],
];

const REMOTE_STATUS_KEYWORDS: Array<[RegExp, RemoteStatus]> = [
  [
    /\bremote\b|remote[-\s]?first|fully\s*remote|work\s*from\s*home|wfh|distributed/,
    "remote",
  ],
  [/hybrid|flex(?:ible)?|partial\s*remote/, "hybrid"],
  [/on[-\s]?site|onsite|in[-\s]?office|in\s+person|office\s+based/, "on_site"],
  [/not\s*specified|unknown|n\/a/, "not_specified"],
];

const SENIORITY_KEYWORDS: Array<[RegExp, SeniorityLevel]> = [
  [/\bintern(ship)?|apprentice|junior|jr|entry|new\s*grad/, "entry"],
  [/\bmid\b|mid[-\s]?level|intermediate|associate/, "mid"],
  [/\bsenior\b|sr\b|sr\./, "senior"],
  [/\bprincipal|staff|lead|architect|manager|supervisor|head\b/, "lead"],
  [
    /\bvp|vice\s+president|svp|evp|cto|cio|cfo|cso|ceo|chief|executive|director|founder|partner|president\b/,
    "executive",
  ],
];

const SOURCE_PATTERNS: Array<[RegExp, JobSource]> = [
  [/^raw\/greenhouse\//i, "greenhouse"],
  [/^greenhouse\//i, "greenhouse"],
  [/^raw\/lever\//i, "lever"],
  [/^lever\//i, "lever"],
  [/^raw\/usajobs\//i, "usajobs"],
  [/^usajobs\//i, "usajobs"],
  [/^raw\/muse/i, "muse"],
  [/^muse-/i, "muse"],
];

const TECHNOLOGY_SPLIT_PATTERN =
  /\s*(?:,|;|\/|\\|\||\band\b|\bor\b|\bwith\b|\busing\b|\bvia\b|\bon\b|\bfor\b|\bin\b)\s*/i;

const BULLET_PATTERN = /[•·∙●▪▫‣◦⦁]/g;

function deriveSource(jobId: string | null | undefined): JobSource | null {
  if (!jobId) return null;
  for (const [pattern, source] of SOURCE_PATTERNS) {
    if (pattern.test(jobId)) return source;
  }
  return null;
}

function sanitizeCompanyBase(raw: string): string {
  const base = normalizeWhitespace(raw.replace(/[\[\](){}]/g, " "));
  const withoutSuffix = base.replace(COMPANY_SUFFIX_PATTERN, "").trim();
  return toTitleCase(withoutSuffix || base);
}

function lookupCompany(name: string, source: JobSource | null): string | null {
  const key = toCompanyKey(name);
  if (!key) return null;
  if (source && SOURCE_COMPANY_DIRECTORY[source]?.has(key)) {
    return SOURCE_COMPANY_DIRECTORY[source]!.get(key)!;
  }
  if (GLOBAL_COMPANY_DIRECTORY.has(key)) {
    return GLOBAL_COMPANY_DIRECTORY.get(key)!;
  }
  return null;
}

function normalizeCompanyName(
  raw: string | null | undefined,
  source: JobSource | null
): string | null {
  const cleaned = nullIfEmpty(raw);
  if (!cleaned) return null;
  const base = sanitizeCompanyBase(cleaned);
  const lookup =
    lookupCompany(base, source) ??
    lookupCompany(toTitleCase(base.replace(/&/g, "and")), source);
  return lookup ?? base;
}

function parseNumericCompanySize(value: string): CompanySize | null {
  const matches = value.match(/\d{1,3}(?:,\d{3})*|\d+/g);
  if (!matches) return null;
  const numbers = matches
    .map((match) => parseInt(match.replace(/,/g, ""), 10))
    .filter((num) => Number.isFinite(num));
  if (numbers.length === 0) return null;
  const largest = Math.max(...numbers);
  if (largest <= 15) return "startup";
  if (largest <= 50) return "small";
  if (largest <= 250) return "medium";
  if (largest <= 1000) return "large";
  return "enterprise";
}

function mapCompanySize(value: unknown): CompanySize | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(String(value)).toLowerCase();
  if (!normalized) return null;

  const numeric = parseNumericCompanySize(normalized);
  if (numeric) return numeric;

  for (const [pattern, size] of COMPANY_SIZE_KEYWORDS) {
    if (pattern.test(normalized)) {
      return size;
    }
  }

  return null;
}

function mapRemoteStatus(value: unknown): RemoteStatus {
  if (!value) return "not_specified";
  const normalized = normalizeWhitespace(String(value)).toLowerCase();
  if (!normalized) return "not_specified";
  for (const [pattern, status] of REMOTE_STATUS_KEYWORDS) {
    if (pattern.test(normalized)) {
      return status;
    }
  }
  return "not_specified";
}

function mapSeniority(value: unknown): SeniorityLevel | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(String(value)).toLowerCase();
  if (!normalized) return null;

  for (const [pattern, level] of SENIORITY_KEYWORDS) {
    if (pattern.test(normalized)) {
      return level;
    }
  }

  return null;
}

function canonicalizeTechnology(value: string): string | null {
  const normalized = normalizeWhitespace(value)
    .replace(BULLET_PATTERN, " ")
    .replace(/[()]/g, " ")
    .trim();
  if (!normalized) return null;

  const sanitized = normalized
    .toLowerCase()
    .replace(/[^a-z0-9\+\#\.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) return null;

  const aliasMatch =
    TECHNOLOGY_ALIAS_LOOKUP.get(sanitized) ??
    TECHNOLOGY_ALIAS_LOOKUP.get(sanitized.replace(/\s+/g, ""));
  if (aliasMatch) {
    return aliasMatch;
  }

  for (const [pattern, canonical] of TECHNOLOGY_REGEX_RULES) {
    if (pattern.test(sanitized)) {
      return canonical;
    }
  }

  if (sanitized.length <= 2 || !/[a-z]/.test(sanitized)) {
    return sanitized.toUpperCase();
  }

  return toTitleCase(normalized);
}

function splitTechnologyEntry(entry: string): string[] {
  const prepared = entry
    .replace(BULLET_PATTERN, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/[()]/g, " ");
  return prepared
    .split(TECHNOLOGY_SPLIT_PATTERN)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function normalizeTechnologyEntry(raw: string): string[] {
  const parts = splitTechnologyEntry(raw);
  return parts
    .map((part) => canonicalizeTechnology(part))
    .filter((name): name is string => !!name);
}

function normalizeTechnologyList(
  rawValues: DynamoJobPosting["technologies"]
): string[] {
  const items = coerceStringArray(rawValues);
  return uniqueCaseInsensitive(
    items.flatMap((entry) => normalizeTechnologyEntry(entry))
  );
}

function normalizeSkillName(raw: string): string | null {
  const cleaned = normalizeWhitespace(raw);
  if (!cleaned) return null;
  if (cleaned.length <= 3 && cleaned === cleaned.toUpperCase()) {
    return cleaned;
  }
  return toTitleCase(cleaned);
}

function normalizeSkillList(rawValues: DynamoJobPosting["skills"]): string[] {
  const items = coerceStringArray(rawValues);
  return uniqueCaseInsensitive(
    items
      .map((entry) => normalizeSkillName(entry))
      .filter((name): name is string => !!name)
  );
}

function normalizeIndustryName(raw: string): string | null {
  const cleaned = normalizeWhitespace(raw);
  if (!cleaned) return null;
  const key = cleaned.toLowerCase();
  if (INDUSTRY_ALIASES[key]) {
    return INDUSTRY_ALIASES[key];
  }
  return toTitleCase(cleaned);
}

function normalizeIndustryList(
  rawValues: DynamoJobPosting["industry"]
): string[] {
  const items = coerceStringArray(rawValues);
  return uniqueCaseInsensitive(
    items
      .map((entry) => normalizeIndustryName(entry))
      .filter((name): name is string => !!name)
  );
}

function deriveStatus(value: unknown): string {
  const cleaned = normalizeWhitespace(
    typeof value === "string" ? value : String(value ?? "")
  );
  if (!cleaned) return "active";
  return cleaned.toLowerCase();
}

function buildCompanyRecord(
  name: string | null,
  size: CompanySize | null
): NewCompanyRecord | null {
  if (!name) return null;
  return { name, size };
}

function buildTechnologyRecords(names: string[]): NewTechnologyRecord[] {
  return names.map((name) => ({ name, type: null }));
}

function buildSkillRecords(names: string[]): NewSkillRecord[] {
  return names.map((name) => ({ name }));
}

function buildIndustryRecords(names: string[]): NewIndustryRecord[] {
  return names.map((name) => ({ name }));
}

function normalizeJobCore(
  posting: DynamoJobPosting,
  source: JobSource | null,
  companyName: string | null,
  remoteStatus: RemoteStatus,
  seniorityLevel: SeniorityLevel | null
): JobNeon {
  const salaryMentioned = parseBooleanLike(posting.salary_mentioned);
  const { min: minimumSalary, max: maximumSalary } = parseSalaryRange(
    nullIfEmpty(posting.salary_range)
  );

  return {
    dynamoId: posting.jobId,
    processedDate: nullIfEmpty(posting.processed_date),
    companyName,
    jobDescription: nullIfEmpty(posting.job_description),
    jobTitle: nullIfEmpty(posting.job_title),
    location: nullIfEmpty(posting.location),
    remoteStatus,
    salaryMentioned,
    minimumSalary,
    maximumSalary,
    seniorityLevel,
    status: deriveStatus(posting.status),
    source,
  };
}

export function normalizeDynamoJobPosting(
  posting: DynamoJobPosting
): NormalizedJobEntities {
  const source = deriveSource(posting.jobId);
  const jobSource: JobSource = source ?? "unknown";
  const companySize = mapCompanySize(posting.company_size);
  const remoteStatus = mapRemoteStatus(posting.remote_status);
  const seniority = mapSeniority(posting.seniority_level);
  const companyName = normalizeCompanyName(posting.company_name, source);

  const technologyNames = normalizeTechnologyList(posting.technologies);
  const skillNames = normalizeSkillList(posting.skills);
  const industryNames = normalizeIndustryList(posting.industry);

  const job = normalizeJobCore(
    posting,
    jobSource,
    companyName,
    remoteStatus,
    seniority
  );

  return {
    job,
    company: buildCompanyRecord(companyName, companySize),
    technologies: buildTechnologyRecords(technologyNames),
    skills: buildSkillRecords(skillNames),
    industries: buildIndustryRecords(industryNames),
  };
}
