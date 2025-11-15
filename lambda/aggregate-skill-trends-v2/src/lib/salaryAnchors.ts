type Role = "developer" | "engineer" | "general";
type Seniority = "junior" | "senior" | "mid" | null;

type AnchorCriteria = {
  roles?: Role[];
  seniority?: Array<Exclude<Seniority, null>>;
  includes?: string[];
};

export type SalaryAnchor = {
  id: string;
  label: string;
  source: "glassdoor" | "indeed" | "composite";
  minimum: number;
  maximum: number;
  median: number;
  criteria: AnchorCriteria[];
};

const anchors: SalaryAnchor[] = [
  {
    id: "gd-junior-software-developer",
    label: "Glassdoor Junior Software Developer",
    source: "glassdoor",
    minimum: 68_000,
    maximum: 121_000,
    median: 90_000,
    criteria: [{ roles: ["developer"], seniority: ["junior"], includes: ["software"] }],
  },
  {
    id: "gd-junior-software-engineer",
    label: "Glassdoor Junior Software Engineer",
    source: "glassdoor",
    minimum: 101_000,
    maximum: 170_000,
    median: 130_000,
    criteria: [{ roles: ["engineer"], seniority: ["junior"], includes: ["software"] }],
  },
  {
    id: "gd-senior-software-engineer",
    label: "Glassdoor Senior Software Engineer",
    source: "glassdoor",
    minimum: 158_000,
    maximum: 248_000,
    median: 196_000,
    criteria: [{ roles: ["engineer"], seniority: ["senior"], includes: ["software"] }],
  },
  {
    id: "gd-senior-software-developer",
    label: "Glassdoor Senior Software Developer",
    source: "glassdoor",
    minimum: 140_000,
    maximum: 215_000,
    median: 172_000,
    criteria: [{ roles: ["developer"], seniority: ["senior"], includes: ["software"] }],
  },
  {
    id: "gd-software-developer",
    label: "Glassdoor Software Developer",
    source: "glassdoor",
    minimum: 95_000,
    maximum: 155_000,
    median: 121_000,
    criteria: [
      { roles: ["developer"], includes: ["software"] },
      { roles: ["developer"], includes: ["full stack", "backend", "frontend"] },
    ],
  },
  {
    id: "gd-software-engineer",
    label: "Glassdoor Software Engineer",
    source: "glassdoor",
    minimum: 118_000,
    maximum: 188_000,
    median: 148_000,
    criteria: [
      { roles: ["engineer"], includes: ["software"] },
      { roles: ["engineer"], includes: ["full stack", "backend", "frontend"] },
    ],
  },
  {
    id: "indeed-software-engineer",
    label: "Indeed Software Engineer",
    source: "indeed",
    minimum: 78_576,
    maximum: 209_653,
    median: 128_350,
    criteria: [
      { roles: ["engineer", "developer"], includes: ["software", "swe"] },
      { roles: ["engineer"], includes: ["full stack", "backend", "frontend"] },
    ],
  },
];

type JobProfile = {
  normalized: string;
  role: Set<Role>;
  seniority: Seniority;
};

type ApplyAnchorsInput = {
  jobTitle: string | null | undefined;
  annualUSD: number | null | undefined;
};

const WEIGHTS = {
  inRange: { actual: 0.7, anchor: 0.3 },
  outOfRange: { actual: 0.35, anchor: 0.65 },
};

const BLEND_TOLERANCE = 100; // USD

const SOFTWARE_FALLBACK_KEYWORDS = [
  "software",
  "full stack",
  "frontend",
  "front end",
  "backend",
  "platform",
  "infrastructure",
  "infra",
  "systems",
  "system",
  "site reliability",
  "sre",
  "reliability",
  "devops",
  "cloud",
  "security",
  "secops",
  "mobile",
  "ios",
  "android",
  "embedded",
  "firmware",
  "robotics",
  "graphics",
  "ai",
  "machine learning",
  "ml",
  "automation",
];

export type AnchoredSalarySource = "actual" | "anchor" | "weighted" | "clamped";

export type AnchoredSalary = {
  annualUSD: number;
  source: AnchoredSalarySource;
  anchor?: SalaryAnchor;
};

export function applySalaryAnchors({
  jobTitle,
  annualUSD,
}: ApplyAnchorsInput): AnchoredSalary | null {
  const anchor = findSalaryAnchor(jobTitle);

  if (!anchor) {
    if (annualUSD == null || Number.isNaN(annualUSD)) return null;
    return { annualUSD, source: "actual" };
  }

  if (annualUSD == null || Number.isNaN(annualUSD)) {
    return {
      annualUSD: anchor.median,
      source: "anchor",
      anchor,
    };
  }

  let blended: number;
  let baseSource: AnchoredSalarySource;
  if (annualUSD < anchor.minimum) {
    blended = weightedAverage(
      annualUSD,
      anchor.minimum,
      WEIGHTS.outOfRange
    );
    baseSource = "weighted";
  } else if (annualUSD > anchor.maximum) {
    blended = weightedAverage(
      annualUSD,
      anchor.maximum,
      WEIGHTS.outOfRange
    );
    baseSource = "weighted";
  } else {
    blended = weightedAverage(
      annualUSD,
      anchor.median,
      WEIGHTS.inRange
    );
    baseSource = "weighted";
  }

  let clamped = clamp(blended, anchor.minimum, anchor.maximum);
  let source: AnchoredSalarySource =
    clamped !== blended ? "clamped" : baseSource;

  if (Math.abs(clamped - annualUSD) <= BLEND_TOLERANCE) {
    clamped = annualUSD;
    source = "actual";
  }

  return {
    annualUSD: clamped,
    source,
    anchor,
  };
}

function weightedAverage(
  actual: number,
  anchorValue: number,
  { actual: actualWeight, anchor: anchorWeight }: { actual: number; anchor: number }
): number {
  const total = actualWeight + anchorWeight;
  return (actual * actualWeight + anchorValue * anchorWeight) / total;
}

function findSalaryAnchor(jobTitle: string | null | undefined): SalaryAnchor | null {
  const profile = jobTitle ? buildProfile(jobTitle) : null;
  if (!profile) return null;
  for (const anchor of anchors) {
    if (anchor.criteria.some((criterion) => matchesCriterion(criterion, profile))) {
      return anchor;
    }
  }
  return null;
}

function matchesCriterion(criterion: AnchorCriteria, profile: JobProfile): boolean {
  if (criterion.roles) {
    const hasRole = criterion.roles.some((role) => profile.role.has(role));
    if (!hasRole) return false;
  }
  if (criterion.seniority) {
    if (!profile.seniority || !criterion.seniority.includes(profile.seniority)) {
      return false;
    }
  }
  if (criterion.includes) {
    let hasKeyword = criterion.includes.some((kw) =>
      profile.normalized.includes(kw.toLowerCase())
    );
    if (!hasKeyword && hasSoftwareRole(criterion.roles)) {
      hasKeyword = matchesSoftwareFallback(profile.normalized);
    }
    if (!hasKeyword) return false;
  } else if (hasSoftwareRole(criterion.roles)) {
    if (!matchesSoftwareFallback(profile.normalized)) return false;
  }
  return true;
}

function hasSoftwareRole(roles?: Role[]): boolean {
  if (!roles) return false;
  return roles.some((role) => role === "developer" || role === "engineer");
}

function matchesSoftwareFallback(normalizedTitle: string): boolean {
  const lower = normalizedTitle.toLowerCase();
  return SOFTWARE_FALLBACK_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildProfile(jobTitle: string): JobProfile {
  const normalized = jobTitle.toLowerCase();
  const tokens = normalized.split(/[^a-z0-9\+]+/).filter(Boolean);
  const role = extractRoles(tokens, normalized);
  const seniority = extractSeniority(tokens);
  return { normalized, role, seniority };
}

function extractRoles(tokens: string[], normalized: string): Set<Role> {
  const roles = new Set<Role>();
  const developerTokens = new Set(["developer", "dev", "development"]);
  const engineerTokens = new Set([
    "engineer",
    "eng",
    "swe",
    "software",
    "backend",
    "frontend",
    "architect",
    "architecture",
    "platform",
    "systems",
    "system",
    "infrastructure",
    "infra",
    "sre",
    "reliability",
    "site",
    "devops",
    "security",
    "secops",
    "cloud",
    "mobile",
    "ios",
    "android",
    "embedded",
    "firmware",
    "robotics",
    "automation",
  ]);

  for (const token of tokens) {
    if (developerTokens.has(token)) roles.add("developer");
    if (engineerTokens.has(token)) roles.add("engineer");
  }
  if (normalized.includes("full stack")) {
    roles.add("developer");
    roles.add("engineer");
  }
  if (normalized.includes("backend")) {
    roles.add("engineer");
    roles.add("developer");
  }
  if (normalized.includes("frontend") || normalized.includes("front end")) {
    roles.add("engineer");
    roles.add("developer");
  }
  if (roles.size === 0) {
    roles.add("general");
  }
  return roles;
}

function extractSeniority(tokens: string[]): Seniority {
  if (tokens.some((token) => ["junior", "jr", "entry", "associate"].includes(token))) {
    return "junior";
  }
  if (
    tokens.some((token) =>
      ["senior", "sr", "lead", "principal", "staff"].includes(token)
    )
  ) {
    return "senior";
  }
  if (tokens.some((token) => ["mid", "intermediate"].includes(token))) {
    return "mid";
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export const salaryAnchors = anchors;
