export const TECHNOLOGIES = [
  // Languages
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

  // Frontend
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

  // Backend
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

  // Cloud & DevOps
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

  // Databases
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

  // Tools & Platforms
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

export interface Education {
  name: string;
  type: "degree" | "bootcamp" | "certification" | "other";
  location?: string;
  date?: string;
}

export interface Experience {
  title?: string;
  company?: string;
  duration?: string;
  location?: string;
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
    technologies: [...new Set(foundTechs)], // dedupe
    softSkills: [...new Set(foundSoftSkills)], // dedupe
  };
}

export interface Education {
  name: string;
  type: "degree" | "bootcamp" | "certification" | "other";
  location?: string;
  date?: string;
}

export function extractEducation(text: string): Education[] {
  const results: Education[] = [];

  // Pattern for bootcamps and coding schools (check this first)
  const bootcampPattern =
    /([A-Za-z\s&]+)?\s*(Bootcamp|Coding Boot[Cc]amp|Training Program|Certificate Program|Professional Certificate|Full Stack[A-Za-z\s]+Bootcamp)/gi;

  // Pattern for formal degrees with more context (word boundary + degree type)
  const degreePattern =
    /\b(Bachelor|Master|Ph\.?D|B\.?S\.|M\.?S\.|Associate|B\.?A\.|M\.?A\.)\b\s+(?:in\s+)?([A-Za-z\s]+)?(?:\s+from\s+)?([A-Za-z\s]+)?/gi;

  // Pattern for universities mentioned anywhere
  const universityPattern =
    /(University of [A-Za-z\s]+|[A-Za-z]+\s+University|[A-Za-z]+\s+College|[A-Za-z]+\s+Institute)/gi;

  let match: RegExpExecArray | null;

  // Extract bootcamps FIRST (higher priority)
  while ((match = bootcampPattern.exec(text)) !== null) {
    const bootcampName = match[0].trim();
    if (!results.some((edu) => edu.name === bootcampName)) {
      results.push({
        name: bootcampName,
        type: "bootcamp",
      });
    }
  }

  // Extract degrees with word boundaries
  while ((match = degreePattern.exec(text)) !== null) {
    const degreeName = match[0].trim();
    // Only add if it looks legitimate (not too short, not already captured)
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

  // Extract universities
  while ((match = universityPattern.exec(text)) !== null) {
    const universityName = match[0].trim();
    // Avoid duplicates
    if (!results.some((edu) => edu.name === universityName)) {
      results.push({
        name: universityName,
        type: "degree",
      });
    }
  }

  return results;
}

export function extractExperienceOld(text: string): Experience[] {
  const results: Experience[] = [];

  if (!text || !text.trim()) return results;

  // 1) Try to find an "Experience" section by common headings; otherwise use entire text.
  const headingRegex =
    /^(?:\s*#{1,6}\s*)?(?:work experience|professional experience|experience|employment history|previous experience|professional background)\b.*$/im;

  // Boundaries that often indicate the next major section
  const nextSectionAnchor =
    /(?=\n(?:#{1,6}\s)|\n(?:Projects|Education|Skills|Summary|Certifications|Awards|Publications|Volunteer|References)\b)/i;

  let block = text;
  const headingMatch = text.match(headingRegex);
  if (headingMatch && typeof headingMatch.index === "number") {
    // start from the end of the matched heading line
    const start = headingMatch.index + headingMatch[0].length;
    const rest = text.slice(start);
    // cut off at next section heading if present
    const nextMatch = rest.search(nextSectionAnchor);
    block = nextMatch === -1 ? rest : rest.slice(0, nextMatch);
  }

  // 2) Normalize whitespace and split into non-empty lines
  const rawLines = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00A0/g, " ").trim()); // convert NBSP
  const lines = rawLines.filter((l) => l.length > 0);

  // 3) Date range detection (covers many common forms)
  const monthNames =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const dateRangeRegex = new RegExp(
    `\\b(?:${monthNames}\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(?:Present|Now|${monthNames}\\s+\\d{4}|\\d{4})\\b`,
    "i"
  );
  const simpleYearRange = /\b\d{4}\s*(?:-|–|—|to)\s*(?:Present|Now|\d{4})\b/;

  // 4) Walk lines; when we find a date line, look backward for title/company (up to N lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (dateRangeRegex.test(line) || simpleYearRange.test(line)) {
      const duration = line;
      // collect up to 4 preceding non-empty lines as context
      const context: string[] = [];
      for (let k = 1; k <= 4; k++) {
        const idx = i - k;
        if (idx < 0) break;
        const cand = lines[idx];
        if (cand) context.push(cand);
      }

      // heuristics to pick title/company/location from context
      let title: string | undefined;
      let company: string | undefined;
      let location: string | undefined;

      // Usually:
      //  - lines[ i-1 ] => company (or company • location)
      //  - lines[ i-2 ] => title
      // But some resumes invert that; apply flexible rules.

      if (context.length >= 1) {
        const prev = context[0];
        // try to parse company + optional location separated by • or comma or " - "
        const compSplit = prev
          .split(/[\u2022•·•]|[-–—]\s+|,\s+at\s+|,\s+/)
          .map((s) => s.trim());
        // If there are two meaningful parts, treat first as company and second as location
        if (compSplit.length >= 2) {
          company = compSplit[0];
          location = compSplit.slice(1).join(", ");
        } else {
          // detect company keywords or corporate abbreviations
          if (
            /(Inc|LLC|Ltd|Corp|Company|Co\.|Solutions|Systems|Technologies|LLP|PLC|GmbH)/i.test(
              prev
            ) ||
            prev.split(/\s+/).length <= 6
          ) {
            company = prev;
          } else {
            // ambiguous: keep as candidate for title or company later
            company = prev;
          }
        }
      }

      if (context.length >= 2) {
        title = context[1];
      }

      // if still missing title, try splitting the company line on separators for a title/company combo
      if (!title && company) {
        const maybe = company.split(/[,—–@-]/).map((s) => s.trim());
        if (maybe.length >= 2) {
          // choose the shorter chunk as title heuristically
          if (maybe[0].split(/\s+/).length <= maybe[1].split(/\s+/).length) {
            title = maybe[0];
            company = maybe.slice(1).join(", ");
          } else {
            title = maybe.slice(1).join(", ");
            company = maybe[0];
          }
        }
      }

      // If title is still missing, check further up for a plausible title (e.g., line containing 'Senior', 'Engineer', 'Manager')
      if (!title && context.length >= 3) {
        for (let j = 2; j < Math.min(context.length, 4); j++) {
          if (
            /(Senior|Lead|Principal|Engineer|Developer|Manager|Director|VP|Consultant|Analyst)/i.test(
              context[j]
            )
          ) {
            title = context[j];
            break;
          }
        }
      }

      // sanitize: remove trailing separators and noise
      const sanitize = (s?: string) =>
        s
          ? s.replace(/^[\u2022\-\–\—\–\s]+|[\u2022\-\–\—\–\s]+$/g, "").trim()
          : undefined;

      title = sanitize(title);
      company = sanitize(company);
      location = sanitize(location);

      // Final guardrails
      if (title && /experience/i.test(title)) title = undefined;
      if (company && company.length > 200) company = undefined;

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
export function extractExperience(text: string): Experience[] {
  const results: Experience[] = [];

  if (!text || !text.trim()) return results;

  // 1) Try to find an "Experience" section by common headings
  const headingRegex =
    /^(?:\s*#{1,6}\s*)?(?:work experience|professional experience|experience|employment history|previous experience|professional background)\b.*$/im;

  // Boundaries that often indicate the next major section
  const nextSectionRegex =
    /\n\s*(?:projects?|education|skills|certifications?|awards?|publications?|volunteer|references|summary)\b/i;

  let block = text;
  const headingMatch = text.match(headingRegex);

  if (headingMatch && typeof headingMatch.index === "number") {
    // Found "EXPERIENCE" heading - extract that section
    const start = headingMatch.index + headingMatch[0].length;
    const rest = text.slice(start);

    // Find where the experience section ends (next major section)
    const nextSectionMatch = rest.match(nextSectionRegex);
    block = nextSectionMatch ? rest.slice(0, nextSectionMatch.index) : rest;
  } else {
    // No explicit "EXPERIENCE" heading found
    // Try to extract experience entries from the whole document by looking for date patterns
    // But stop at common section boundaries

    // Find the earliest section boundary
    const sectionMatch = text.match(nextSectionRegex);
    if (sectionMatch && sectionMatch.index) {
      // If we find a section like "PROJECTS" or "EDUCATION", assume experience comes before it
      const possibleExperienceBlock = text.slice(0, sectionMatch.index);

      // Check if this block has date patterns (indicates experience entries)
      const monthNames =
        "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
      const dateRangeRegex = new RegExp(
        `(?:${monthNames}\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(?:Present|Now|${monthNames}\\s+\\d{4}|\\d{4})`,
        "i"
      );

      if (dateRangeRegex.test(possibleExperienceBlock)) {
        block = possibleExperienceBlock;
      } else {
        // No dates found before first section - return empty
        return results;
      }
    }
    // else: no section boundaries found, use entire text (will be filtered by date presence below)
  }

  // 2) Normalize whitespace and split into non-empty lines
  const rawLines = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00A0/g, " ").trim()); // convert NBSP
  const lines = rawLines.filter((l) => l.length > 0);

  // 3) Date range detection (covers many common forms)
  const monthNames =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const dateRangeRegex = new RegExp(
    `\\b(?:${monthNames}\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(?:Present|Now|${monthNames}\\s+\\d{4}|\\d{4})\\b`,
    "i"
  );
  const simpleYearRange = /\b\d{4}\s*(?:-|–|—|to)\s*(?:Present|Now|\d{4})\b/;

  // 4) Walk lines; when we find a date line, look backward for title/company (up to N lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (dateRangeRegex.test(line) || simpleYearRange.test(line)) {
      const duration = line;
      // collect up to 4 preceding non-empty lines as context
      const context: string[] = [];
      for (let k = 1; k <= 4; k++) {
        const idx = i - k;
        if (idx < 0) break;
        const cand = lines[idx];
        if (cand) context.push(cand);
      }

      // heuristics to pick title/company/location from context
      let title: string | undefined;
      let company: string | undefined;
      let location: string | undefined;

      // Usually:
      //  - lines[ i-1 ] => company (or company • location)
      //  - lines[ i-2 ] => title
      // But some resumes invert that; apply flexible rules.

      if (context.length >= 1) {
        const prev = context[0];
        // try to parse company + optional location separated by • or comma or " - "
        const compSplit = prev
          .split(/[\u2022•·•|]|[-–—]\s+|,\s+at\s+|,\s+/)
          .map((s) => s.trim());
        // If there are two meaningful parts, treat first as company and second as location
        if (compSplit.length >= 2) {
          company = compSplit[0];
          location = compSplit.slice(1).join(", ");
        } else {
          // detect company keywords or corporate abbreviations
          if (
            /(Inc|LLC|Ltd|Corp|Company|Co\.|Solutions|Systems|Technologies|LLP|PLC|GmbH|Operations|Health)/i.test(
              prev
            ) ||
            prev.split(/\s+/).length <= 6
          ) {
            company = prev;
          } else {
            // ambiguous: keep as candidate for title or company later
            company = prev;
          }
        }
      }

      if (context.length >= 2) {
        title = context[1];
      }

      // if still missing title, try splitting the company line on separators for a title/company combo
      if (!title && company) {
        const maybe = company.split(/[,—–@-]/).map((s) => s.trim());
        if (maybe.length >= 2) {
          // choose the shorter chunk as title heuristically
          if (maybe[0].split(/\s+/).length <= maybe[1].split(/\s+/).length) {
            title = maybe[0];
            company = maybe.slice(1).join(", ");
          } else {
            title = maybe.slice(1).join(", ");
            company = maybe[0];
          }
        }
      }

      // If title is still missing, check further up for a plausible title (e.g., line containing 'Senior', 'Engineer', 'Manager')
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

      // sanitize: remove trailing separators and noise
      const sanitize = (s?: string) =>
        s
          ? s.replace(/^[\u2022\-–—•\s]+|[\u2022\-–—•\s]+$/g, "").trim()
          : undefined;

      title = sanitize(title);
      company = sanitize(company);
      location = sanitize(location);

      // Final guardrails
      if (title && /experience/i.test(title)) title = undefined;
      if (company && company.length > 200) company = undefined;

      // Skip if we don't have at least a title or company
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
