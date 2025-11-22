const TECH_ALIASES: Record<string, string> = {
  "react.js": "React",
  reactjs: "React",
  nodejs: "Node.js",
  "node.js": "Node.js",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  py: "Python",
  postgres: "PostgreSQL",
  mongo: "MongoDB",
  "ms sql": "SQL Server",
  sqlserver: "SQL Server",
  mssql: "SQL Server",
  "aws s3": "Amazon S3",
  s3: "Amazon S3",
  "aws lambda": "AWS Lambda",
  lambda: "AWS Lambda",
  dotnet: ".NET",
  csharp: "C#",
  "c#": "C#",
  gcp: "Google Cloud",
  "azure devops": "Azure DevOps",
};

const SKILL_ALIASES: Record<string, string> = {
  comm: "Communication",
  "communication skills": "Communication",
  "team work": "Teamwork",
  teamwork: "Teamwork",
  "problem solving": "Problem Solving",
  leadership: "Leadership",
  "time management": "Time Management",
  analytical: "Analytical Thinking",
  "attention to detail": "Attention to Detail",
};

export function canonicalizeTech(raw: string[]): string[] {
  return dedupe(raw.map(normalize).map((c) => TECH_ALIASES[c] ?? title(c)));
}
export function canonicalizeSoftSkill(raw: string[]): string[] {
  return dedupe(raw.map(normalize).map((c) => SKILL_ALIASES[c] ?? title(c)));
}

export type AggDim = "technology" | "skill" | "both";

export function selectPrimarySet(
  techs: string[],
  softSkills: string[],
  dim: AggDim
): string[] {
  if (dim === "technology") return techs;
  if (dim === "skill") return softSkills;
  return dedupe([...techs, ...softSkills]);
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[._]/g, ".");
}
function title(s: string) {
  return s.replace(
    /\w\S*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}
function dedupe(arr: string[]) {
  return [...new Set(arr.filter(Boolean))];
}
