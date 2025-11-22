import type { Experience } from "./types.js";

export const TECHNOLOGIES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
  "kotlin",
  "scala",
  "elixir",
  "haskell",
  "clojure",
  "perl",
  "swift",
  "objective-c",

  "react",
  "vue",
  "angular",
  "svelte",
  "nextjs",
  "nuxt",
  "gatsby",
  "astro",
  "html",
  "css",
  "tailwind",
  "bootstrap",
  "material-ui",
  "webpack",
  "vite",

  "nodejs",
  "express",
  "nestjs",
  "django",
  "flask",
  "fastapi",
  "spring",
  "dotnet",
  "rails",
  "laravel",
  "asp.net",
  "grpc",
  "graphql",
  "rest",

  "aws",
  "azure",
  "gcp",
  "kubernetes",
  "docker",
  "terraform",
  "jenkins",
  "gitlab-ci",
  "github-actions",
  "circleci",
  "s3",
  "lambda",
  "ec2",
  "rds",
  "dynamodb",

  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "elasticsearch",
  "cassandra",
  "oracle",
  "sqlite",
  "firestore",
  "dynamodb",
  "memcached",

  "git",
  "linux",
  "macos",
  "windows",
  "jira",
  "confluence",
  "slack",
  "figma",
  "datadog",
  "prometheus",
  "grafana",
  "postman",
  "vim",
  "vscode",
];

export const SOFT_SKILLS = [
  "leadership",
  "team leadership",
  "communication",
  "problem solving",
  "project management",
  "agile",
  "scrum",
  "kanban",
  "mentoring",
  "public speaking",
  "negotiation",
  "conflict resolution",
  "critical thinking",
  "time management",
  "collaboration",
  "documentation",
  "code review",
];

const EXPERIENCE_HEADINGS = [
  "experience",
  "work experience",
  "professional experience",
  "employment history",
  "previous experience",
  "professional background",
];

const NEXT_SECTION_KEYWORDS = [
  "education",
  "skills",
  "summary",
  "certifications",
  "projects",
  "awards",
  "publications",
  "volunteer",
  "references",
];

const monthNames =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

const DATE_RANGE_REGEX = new RegExp(
  `\\b(?:${monthNames}\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(?:Present|Now|${monthNames}\\s+\\d{4}|\\d{4})\\b`,
  "i"
);
const SIMPLE_YEAR_RANGE = /\b\d{4}\s*(?:-|–|—|to)\s*(?:Present|Now|\d{4})\b/;

const sanitize = (s?: string) =>
  s
    ? s
        .replace(/^[\u2022\-\–\—\•\·\|\s,]+|[\u2022\-\–\—\•\·\|\s,]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    : undefined;

export interface Education {
  name: string;
  type: "degree" | "bootcamp" | "certification" | "other";
  location?: string;
  date?: string;
}

export function extractSkills(text: string): {
  technologies: string[];
  softSkills: string[];
} {
  const normalizedText = text.toLowerCase();

  const foundTechs = TECHNOLOGIES.filter((tech) =>
    new RegExp(`\\b${tech.replace(/[-+.]/g, "\\$&")}\\b`, "i").test(
      normalizedText
    )
  );

  const foundSoftSkills = SOFT_SKILLS.filter((skill) =>
    new RegExp(`\\b${skill.replace(/[-+.]/g, "\\$&")}\\b`, "i").test(
      normalizedText
    )
  );

  return {
    technologies: [...new Set(foundTechs)],
    softSkills: [...new Set(foundSoftSkills)],
  };
}

export function extractEducation(text: string): Education[] {
  const results: Education[] = [];

  const bootcampPattern =
    /([A-Za-z\s&]+)?\s*(Bootcamp|Coding Boot[Cc]amp|Training Program|Certificate Program|Professional Certificate|Full Stack[A-Za-z\s]+Bootcamp)/gi;

  const degreePattern =
    /\b(Bachelor|Master|Ph\.?D|B\.?S\.|M\.?S\.|Associate|B\.?A\.|M\.?A\.)\b\s+(?:in\s+)?([A-Za-z\s]+)?(?:\s+from\s+)?([A-Za-z\s]+)?/gi;

  const universityPattern =
    /(University of [A-Za-z\s]+|[A-Za-z]+\s+University|[A-Za-z]+\s+College|[A-Za-z]+\s+Institute)/gi;

  let match: RegExpExecArray | null;

  while ((match = bootcampPattern.exec(text)) !== null) {
    const bootcampName = match[0].trim();
    if (!results.some((edu) => edu.name === bootcampName)) {
      results.push({
        name: bootcampName,
        type: "bootcamp",
      });
    }
  }

  while ((match = degreePattern.exec(text)) !== null) {
    const degreeName = match[0].trim();

    if (
      degreeName.length > 5 &&
      !results.some((edu) => edu.name === degreeName)
    ) {
      results.push({
        name: degreeName,
        type: "degree",
        location: match[3]?.trim(),
      });
    }
  }

  while ((match = universityPattern.exec(text)) !== null) {
    const universityName = match[0].trim();

    if (!results.some((edu) => edu.name === universityName)) {
      results.push({
        name: universityName,
        type: "degree",
      });
    }
  }

  return results;
}

function splitHeaderParts(header: string): {
  title?: string;
  company?: string;
  location?: string;
} {
  if (!header) return {};

  let tokens = header
    .split(/[\u2022\•\·\|]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (tokens.length === 1) {
    tokens = header
      .split(/\s{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (tokens.length === 1) {
    tokens = header
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (tokens.length === 1) {
    const maybe = header
      .split(/[-–—]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (maybe.length > 1 && maybe[0].split(/\s+/).length <= 6) tokens = maybe;
  }

  if (tokens.length >= 3) {
    return {
      title: tokens[0],
      company: tokens[1],
      location: tokens.slice(2).join(", "),
    };
  }
  if (tokens.length === 2) {
    const [a, b] = tokens;
    const titleLike =
      /(Senior|Lead|Principal|Engineer|Developer|Manager|Director|Analyst|Programmer|Consultant|Designer)/i;
    if (titleLike.test(a) && !titleLike.test(b)) {
      return { title: a, company: b };
    }
    if (titleLike.test(b) && !titleLike.test(a)) {
      return { title: b, company: a };
    }

    return a.split(/\s+/).length <= b.split(/\s+/).length
      ? { title: a, company: b }
      : { title: b, company: a };
  }

  return { title: tokens[0] };
}

function parseExperienceEntryFromContext(
  lines: string[],
  durationLine: string
): Experience | null {
  if (!durationLine && (!lines || lines.length === 0)) return null;

  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  let title: string | undefined;
  let company: string | undefined;
  let location: string | undefined;

  if (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    const match = last.match(DATE_RANGE_REGEX) || last.match(SIMPLE_YEAR_RANGE);
    if (match) {
      const pre = last.replace(match[0], "").trim();
      if (pre) {
        cleaned[cleaned.length - 1] = pre;
      } else {
        cleaned.pop();
      }
    }
  }

  if (cleaned.length >= 3) {
    title = cleaned[0];
    company = cleaned[1];
    location = cleaned[2];
  } else if (cleaned.length === 2) {
    const maybe = splitHeaderParts(cleaned.join(" • "));
    title = maybe.title || cleaned[0];
    company = maybe.company || cleaned[1];
    location = maybe.location;
  } else if (cleaned.length === 1) {
    const parts = splitHeaderParts(cleaned[0]);
    title = parts.title;
    company = parts.company;
    location = parts.location;
  } else {
    return null;
  }

  if (company) {
    const sub = company
      .split(/[\u2022\•\·\|]|[-–—]\s+|[\(\[]|,\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sub.length >= 2) {
      company = sub[0];
      location =
        location ||
        sub
          .slice(1)
          .join(", ")
          .replace(/[\)\]]$/, "")
          .trim();
    }
  }

  title = sanitize(title);
  company = sanitize(company);
  location = sanitize(location);
  const duration = sanitize(durationLine) || "";

  if (!title && !company) return null;
  if (title && /experience/i.test(title)) title = undefined;
  if (company && company.length > 200) company = undefined;

  return { title, company, location, duration };
}

export function extractExperiencePdf(text: string): Experience[] {
  const results: Experience[] = [];

  if (!text || !text.trim()) return results;

  const headingRegex =
    /^(?:\s*#{1,6}\s*)?(?:work experience|professional experience|experience|employment history|previous experience|professional background)\b.*$/im;

  const nextSectionRegex =
    /\n\s*(?:projects?|education|skills|certifications?|awards?|publications?|volunteer|references|summary)\b/i;

  let block = text;
  const headingMatch = text.match(headingRegex);

  if (headingMatch && typeof headingMatch.index === "number") {
    const start = headingMatch.index + headingMatch[0].length;
    const rest = text.slice(start);

    const nextSectionMatch = rest.match(nextSectionRegex);
    block = nextSectionMatch ? rest.slice(0, nextSectionMatch.index) : rest;
  } else {
    const sectionMatch = text.match(nextSectionRegex);
    if (sectionMatch && sectionMatch.index) {
      const possibleExperienceBlock = text.slice(0, sectionMatch.index);

      const monthNames =
        "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
      const dateRangeRegex = new RegExp(
        `(?:${monthNames}\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(?:Present|Now|${monthNames}\\s+\\d{4}|\\d{4})`,
        "i"
      );

      if (dateRangeRegex.test(possibleExperienceBlock)) {
        block = possibleExperienceBlock;
      } else {
        return results;
      }
    }
  }

  const rawLines = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00A0/g, " ").trim());
  const lines = rawLines.filter((l) => l.length > 0);

  const monthNames =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const dateRangeRegex = new RegExp(
    `\\b(?:${monthNames}\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(?:Present|Now|${monthNames}\\s+\\d{4}|\\d{4})\\b`,
    "i"
  );
  const simpleYearRange = /\b\d{4}\s*(?:-|–|—|to)\s*(?:Present|Now|\d{4})\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (dateRangeRegex.test(line) || simpleYearRange.test(line)) {
      const duration = line;

      const context: string[] = [];
      for (let k = 1; k <= 4; k++) {
        const idx = i - k;
        if (idx < 0) break;
        const cand = lines[idx];
        if (cand) context.push(cand);
      }

      let title: string | undefined;
      let company: string | undefined;
      let location: string | undefined;

      if (context.length >= 1) {
        const prev = context[0];

        const compSplit = prev
          .split(/[\u2022•·•|]|[-–—]\s+|,\s+at\s+|,\s+/)
          .map((s) => s.trim());

        if (compSplit.length >= 2) {
          company = compSplit[0];
          location = compSplit.slice(1).join(", ");
        } else {
          if (
            /(Inc|LLC|Ltd|Corp|Company|Co\.|Solutions|Systems|Technologies|LLP|PLC|GmbH|Operations|Health)/i.test(
              prev
            ) ||
            prev.split(/\s+/).length <= 6
          ) {
            company = prev;
          } else {
            company = prev;
          }
        }
      }

      if (context.length >= 2) {
        title = context[1];
      }

      if (!title && company) {
        const maybe = company.split(/[,—–@-]/).map((s) => s.trim());
        if (maybe.length >= 2) {
          if (maybe[0].split(/\s+/).length <= maybe[1].split(/\s+/).length) {
            title = maybe[0];
            company = maybe.slice(1).join(", ");
          } else {
            title = maybe.slice(1).join(", ");
            company = maybe[0];
          }
        }
      }

      if (!title && context.length >= 3) {
        for (let j = 2; j < Math.min(context.length, 4); j++) {
          if (
            /(Senior|Lead|Principal|Engineer|Developer|Manager|Director|Coordinator|Analyst|Programmer|Technician)/i.test(
              context[j]
            )
          ) {
            title = context[j];
            break;
          }
        }
      }

      const sanitize = (s?: string) =>
        s
          ? s.replace(/^[\u2022\-–—•\s]+|[\u2022\-–—•\s]+$/g, "").trim()
          : undefined;

      title = sanitize(title);
      company = sanitize(company);
      location = sanitize(location);

      if (title && /experience/i.test(title)) title = undefined;
      if (company && company.length > 200) company = undefined;

      if (!title && !company) continue;

      results.push({
        title,
        company,
        location,
        duration: duration.trim(),
      });
    }
  }

  return results;
}
