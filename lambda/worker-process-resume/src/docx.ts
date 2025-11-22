import type { Experience } from "./types.js";

export function extractExperience(text: string): Experience[] {
  if (!text?.trim()) return [];

  const block = extractExperienceSection(text);
  const lines = normalizeLines(block);

  const jobBoundaries = findJobBoundaries(lines);

  return jobBoundaries
    .map((boundary) => parseJobEntry(lines, boundary))
    .filter(
      (job): job is Experience =>
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
    .replace(/\u00A0/g, " ")
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

  const dateRangeRegex = createDateRangeRegex();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isBulletOrDescription(line)) continue;

    if (isDateRangeLine(line, dateRangeRegex)) {
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
  const bulletPatterns = [
    /^[-•·*]\s+/,
    /^[a-z]/,
    /^(?:Developed|Built|Implemented|Designed|Created|Architected|Led|Managed)/i,
  ];

  return bulletPatterns.some((pattern) => pattern.test(line));
}

function isDateRangeLine(line: string, dateRegex: RegExp): boolean {
  if (!dateRegex.test(line)) return false;

  const withoutDate = line.replace(dateRegex, "").trim();
  if (withoutDate.length > 60) return false;

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

  const duration = extractDuration(dateLine);

  const contextLines = lines.slice(contextStart, dateLineIndex);
  const { title, company, location } = parseMetadata(contextLines, dateLine);

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
  const separators = [/\s+[\u2022•·]\s+/, /\s+[-–—]\s+/, /,\s+/, /\s+\(\s*/];

  for (const sep of separators) {
    const parts = line.split(sep).map((s) => s.replace(/[()]/g, "").trim());
    if (parts.length === 2) {
      const [part1, part2] = parts;
      if (looksLikeLocation(part2)) {
        return { company: part1, location: part2 };
      } else if (looksLikeLocation(part1)) {
        return { company: part2, location: part1 };
      }

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
  const locationPatterns = [
    /\b(?:remote|hybrid)\b/i,
    /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/,
    /\b(?:CA|NY|TX|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|MN|CO)\b/,
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

  if (cleaned.length < 2 || cleaned.length > 200) return undefined;
  if (/^experience$/i.test(cleaned)) return undefined;

  return cleaned;
}
