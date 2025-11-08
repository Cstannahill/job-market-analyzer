import type { Experience } from "./types.js";

export function extractExperience(text: string): Experience[] {
  if (!text?.trim()) return [];

  // Extract experience section
  const block = extractExperienceSection(text);
  const lines = normalizeLines(block);

  // Find all job entry boundaries (lines with date ranges at structural level)
  const jobBoundaries = findJobBoundaries(lines);

  // Parse each job entry
  return jobBoundaries
    .map((boundary) => parseJobEntry(lines, boundary))
    .filter(
      (job): job is Experience =>
        // Filter out invalid entries
        !!(job?.title || job?.company) && !!job?.duration
    );
}

function extractExperienceSection(text: string): string {
  const headingRegex =
    /^(?:\s*#{1,6}\s*)?(?:work experience|professional experience|experience|employment history|previous experience|professional background)\b.*$/im;

  const nextSectionRegex =
    /(?=\n(?:#{1,6}\s)|\n(?:Projects|Education|Skills|Summary|Certifications|Awards|Publications|Volunteer|References)\b)/i;

  const headingMatch = text.match(headingRegex);
  if (!headingMatch || typeof headingMatch.index !== "number") {
    return text;
  }

  const start = headingMatch.index + headingMatch[0].length;
  const rest = text.slice(start);
  const nextMatch = rest.search(nextSectionRegex);

  return nextMatch === -1 ? rest : rest.slice(0, nextMatch);
}

function normalizeLines(block: string): string[] {
  return block
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ") // NBSP to regular space
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

interface JobBoundary {
  dateLineIndex: number;
  dateLine: string;
  contextStart: number;
}

function findJobBoundaries(lines: string[]): JobBoundary[] {
  const boundaries: JobBoundary[] = [];

  // More restrictive date pattern - must be at start of line or after minimal prefix
  const dateRangeRegex = createDateRangeRegex();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip if line looks like a bullet point or description
    if (isBulletOrDescription(line)) continue;

    // Check if this line contains a date range as primary content
    if (isDateRangeLine(line, dateRangeRegex)) {
      // Look backward for context (up to 3 lines)
      const contextStart = Math.max(0, i - 3);

      boundaries.push({
        dateLineIndex: i,
        dateLine: line,
        contextStart,
      });
    }
  }

  return boundaries;
}

function createDateRangeRegex(): RegExp {
  const monthNames =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

  return new RegExp(
    `^[\\s\\*\\-•·]*(?:${monthNames}\\s+\\d{4}|\\d{4})\\s*(?:-|–|—|to)\\s*(?:Present|Now|Current|${monthNames}\\s+\\d{4}|\\d{4})`,
    "i"
  );
}

function isBulletOrDescription(line: string): boolean {
  // Check for common bullet indicators
  const bulletPatterns = [
    /^[-•·*]\s+/, // Starts with bullet
    /^[a-z]/, // Starts with lowercase (likely continuation)
    /^(?:Developed|Built|Implemented|Designed|Created|Architected|Led|Managed)/i, // Action verbs
  ];

  return bulletPatterns.some((pattern) => pattern.test(line));
}

function isDateRangeLine(line: string, dateRegex: RegExp): boolean {
  // Must match date pattern
  if (!dateRegex.test(line)) return false;

  // Should not have excessive text after the date (max ~60 chars for location)
  const withoutDate = line.replace(dateRegex, "").trim();
  if (withoutDate.length > 60) return false;

  // Should not contain common description indicators
  const descriptionIndicators = [
    "designed",
    "developed",
    "built",
    "implemented",
    "created",
    "managed",
    "led",
    "collaborated",
    "enhanced",
    "optimized",
  ];

  return !descriptionIndicators.some((indicator) =>
    line.toLowerCase().includes(indicator)
  );
}

function parseJobEntry(
  lines: string[],
  boundary: JobBoundary
): Experience | null {
  const { dateLineIndex, dateLine, contextStart } = boundary;

  // Extract date range
  const duration = extractDuration(dateLine);

  // Parse metadata from context lines (up to date line)
  const contextLines = lines.slice(contextStart, dateLineIndex);
  const { title, company, location } = parseMetadata(contextLines, dateLine);

  // Extract description (lines after date until next boundary or end)
  const descriptionStart = dateLineIndex + 1;
  const descriptionEnd = findNextJobBoundary(lines, descriptionStart);
  const description = lines
    .slice(descriptionStart, descriptionEnd)
    .filter((line) => isBulletOrDescription(line));

  return {
    title,
    company,
    location,
    duration,
    description: description.length > 0 ? description : undefined,
  };
}

function extractDuration(dateLine: string): string {
  const dateRegex = createDateRangeRegex();
  const match = dateLine.match(dateRegex);
  return match
    ? match[0].trim().replace(/^[\\s\\*\\-•·]+/, "")
    : dateLine.trim();
}

function parseMetadata(
  contextLines: string[],
  dateLine: string
): Pick<Experience, "title" | "company" | "location"> {
  let title: string | undefined;
  let company: string | undefined;
  let location: string | undefined;

  // Check if date line contains location info (after the date)
  const dateRegex = createDateRangeRegex();
  const dateMatch = dateLine.match(dateRegex);
  if (dateMatch) {
    const afterDate = dateLine
      .slice(dateMatch.index! + dateMatch[0].length)
      .trim();
    if (afterDate && afterDate.length <= 50) {
      location = afterDate;
    }
  }

  // Parse context lines (most recent first, which is typical resume format)
  if (contextLines.length >= 1) {
    const line1 = contextLines[contextLines.length - 1];
    const parsed = parseCompanyLocationLine(line1);
    company = parsed.company;
    if (!location && parsed.location) {
      location = parsed.location;
    }
  }

  if (contextLines.length >= 2) {
    title = contextLines[contextLines.length - 2];
  }

  // Heuristic: if we only found one context line and it looks like a title, treat it as such
  if (!title && company && contextLines.length === 1) {
    if (looksLikeTitle(company)) {
      title = company;
      company = undefined;
    }
  }

  return {
    title: sanitize(title),
    company: sanitize(company),
    location: sanitize(location),
  };
}

function parseCompanyLocationLine(line: string): {
  company?: string;
  location?: string;
} {
  // Try to split on common separators
  const separators = [
    /\s+[\u2022•·]\s+/, // Bullet
    /\s+[-–—]\s+/, // Dash
    /,\s+/, // Comma
    /\s+\(\s*/, // Opening paren
  ];

  for (const sep of separators) {
    const parts = line.split(sep).map((s) => s.replace(/[()]/g, "").trim());
    if (parts.length === 2) {
      // Heuristic: shorter part is usually location, longer is company
      // But check for location indicators
      const [part1, part2] = parts;
      if (looksLikeLocation(part2)) {
        return { company: part1, location: part2 };
      } else if (looksLikeLocation(part1)) {
        return { company: part2, location: part1 };
      }
      // Default: first is company
      return { company: part1, location: part2 };
    }
  }

  return { company: line };
}

function looksLikeTitle(text: string): boolean {
  const titleKeywords = [
    "engineer",
    "developer",
    "manager",
    "director",
    "lead",
    "senior",
    "principal",
    "architect",
    "analyst",
    "consultant",
    "specialist",
  ];

  const lower = text.toLowerCase();
  return titleKeywords.some((keyword) => lower.includes(keyword));
}

function looksLikeLocation(text: string): boolean {
  // Check for location indicators
  const locationPatterns = [
    /\b(?:remote|hybrid)\b/i,
    /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/, // City, ST
    /\b(?:CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|MN|CO)\b/, // State codes
  ];

  return (
    locationPatterns.some((pattern) => pattern.test(text)) ||
    text.split(/\s+/).length <= 4
  );
}

function findNextJobBoundary(lines: string[], startIndex: number): number {
  const dateRegex = createDateRangeRegex();

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!isBulletOrDescription(line) && isDateRangeLine(line, dateRegex)) {
      return i;
    }
  }

  return lines.length;
}

function sanitize(text?: string): string | undefined {
  if (!text) return undefined;

  const cleaned = text
    .replace(/^[\u2022\-\–\—\*\s]+|[\u2022\-\–\—\*\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Filter out noise
  if (cleaned.length < 2 || cleaned.length > 200) return undefined;
  if (/^experience$/i.test(cleaned)) return undefined;

  return cleaned;
}
