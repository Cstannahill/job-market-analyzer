import type {
  DynamoStringAttribute,
  DynamoStringCollection,
  Nullable,
} from "./types.js";

const MULTI_DASH_REGEX = /[-—–]/;

const CLEAN_NON_WORD = /[^\p{L}\p{N}\s\-]/gu;
const COLLAPSE_WHITESPACE = /\s+/g;

const MAX_REASONABLE_SALARY = 1_000_000;

export function isDynamoStringAttribute(
  value: unknown
): value is DynamoStringAttribute {
  return Boolean(
    value &&
      typeof value === "object" &&
      "S" in (value as Record<string, unknown>) &&
      typeof (value as DynamoStringAttribute).S === "string"
  );
}

export function normalizeWhitespace(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(COLLAPSE_WHITESPACE, " ").trim();
}

export function nullIfEmpty(
  input: string | null | undefined
): string | null {
  const normalized = normalizeWhitespace(input ?? "");
  return normalized.length === 0 ? null : normalized;
}

export function slugify(input: string | null | undefined): string {
  if (!input) return "";
  return normalizeWhitespace(input)
    .toLowerCase()
    .replace(CLEAN_NON_WORD, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toTitleCase(input: string | null | undefined): string {
  const normalized = normalizeWhitespace(input);
  if (!normalized) return "";
  return normalized.replace(/\w\S*/g, (word) => {
    const lower = word.toLowerCase();
    if (lower.length === 1) return lower.toUpperCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

export function parseBooleanLike(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  }
  return null;
}

function parseJsonArray(value: string): unknown[] | null {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function coerceStringArray(
  value:
    | DynamoStringCollection
    | string
    | null
    | undefined
    | Array<unknown>
): string[] {
  if (!value) return [];

  let rawItems: unknown[] = [];

  if (typeof value === "string") {
    rawItems = parseJsonArray(value) ?? [value];
  } else if (Array.isArray(value)) {
    rawItems = value;
  } else {
    rawItems = [value];
  }

  const normalized: string[] = [];

  for (const item of rawItems) {
    if (typeof item === "string") {
      const cleaned = normalizeWhitespace(item);
      if (cleaned) normalized.push(cleaned);
      continue;
    }
    if (isDynamoStringAttribute(item)) {
      const cleaned = normalizeWhitespace(item.S);
      if (cleaned) normalized.push(cleaned);
      continue;
    }
    if (item && typeof item === "object") {
      const maybeString = (item as Record<string, unknown>).S;
      if (typeof maybeString === "string") {
        const cleaned = normalizeWhitespace(maybeString);
        if (cleaned) normalized.push(cleaned);
      }
    }
  }

  return uniqueCaseInsensitive(normalized);
}

type ParsedSalaryPart = {
  raw: string;
  base: number;
  multiplier: number;
  hasExplicitHint: boolean;
  value: number;
};

const MULTIPLIER_PATTERNS: Array<[RegExp, number]> = [
  [/\b(b|bn|billion)\b/, 1_000_000_000],
  [/\b(m|mn|million)\b/, 1_000_000],
  [/\b(k|thousand)\b/, 1_000],
  [/\b(lpa|lakh)\b/, 100_000],
  [/\b(crore)\b/, 10_000_000],
];

function detectMultiplier(lowered: string): {
  multiplier: number;
  hasExplicitHint: boolean;
} {
  for (const [pattern, factor] of MULTIPLIER_PATTERNS) {
    if (pattern.test(lowered)) {
      return { multiplier: factor, hasExplicitHint: true };
    }
  }
  return { multiplier: 1, hasExplicitHint: false };
}

function reduceExcessiveMagnitude(
  value: number,
  hasExplicitHint: boolean
): number | null {
  if (value <= MAX_REASONABLE_SALARY) return Math.round(value);
  if (hasExplicitHint) {
    return Math.min(Math.round(value), MAX_REASONABLE_SALARY);
  }
  let adjusted = value;
  let safety = 0;
  while (adjusted > MAX_REASONABLE_SALARY && adjusted % 10 === 0 && safety < 10) {
    adjusted = Math.round(adjusted / 10);
    safety += 1;
  }
  if (adjusted > MAX_REASONABLE_SALARY) {
    return null;
  }
  return Math.round(adjusted);
}

function parseSalaryPart(part: string): ParsedSalaryPart | null {
  const lowered = part.toLowerCase();
  const numericMatch = lowered.match(/(\d+(?:\.\d+)?)/);
  if (!numericMatch) return null;
  const base = parseFloat(numericMatch[1]);
  if (Number.isNaN(base)) return null;

  const { multiplier, hasExplicitHint } = detectMultiplier(lowered);
  let value = Math.round(base * multiplier);

  if (value > MAX_REASONABLE_SALARY) {
    const reduced = reduceExcessiveMagnitude(value, hasExplicitHint);
    if (reduced === null) return null;
    value = reduced;
  }

  return {
    raw: part,
    base,
    multiplier,
    hasExplicitHint,
    value,
  };
}

export function parseSalaryRange(
  raw: string | null | undefined
): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };

  const sanitized = raw.replace(/[$,]/g, "").trim();
  if (!sanitized) return { min: null, max: null };

  const parts = sanitized
    .split(MULTI_DASH_REGEX)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return { min: null, max: null };

  const parsedParts = parts
    .map((part) => parseSalaryPart(part))
    .filter((entry): entry is ParsedSalaryPart => entry !== null);

  if (parsedParts.length === 0) return { min: null, max: null };

  const maxMultiplier = Math.max(
    ...parsedParts.map((entry) => entry.multiplier)
  );

  if (maxMultiplier > 1) {
    for (const entry of parsedParts) {
      if (
        entry.multiplier === 1 &&
        !entry.hasExplicitHint &&
        entry.base < 1_000
      ) {
        const scaledValue = reduceExcessiveMagnitude(
          entry.base * maxMultiplier,
          true
        );
        if (scaledValue !== null) {
          entry.value = scaledValue;
        }
      }
    }
  }

  const values = parsedParts.map((entry) => entry.value);

  if (values.length === 1) {
    return { min: values[0], max: values[0] };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }
  return deduped;
}

