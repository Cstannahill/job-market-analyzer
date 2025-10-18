import JSON5 from "json5";
function sanitizeJsonString(s: string): string {
  if (!s) return s;

  let out = s;

  // 1) Replace smart quotes and similar Unicode punctuation with plain ASCII equivalents
  out = out.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // single smart quotes -> '
  out = out.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"'); // double smart quotes -> "
  out = out.replace(/\u2013|\u2014/g, "-"); // en-dash/em-dash -> hyphen
  // Remove any zero-width or control characters that can break parsing
  out = out.replace(/[\u200B-\u200F\uFEFF]/g, "");

  // 2) If the model included code fences, strip them
  out = out.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  // 3) Remove trailing commas before } or ]
  //    Example: {"a":1,}  -> {"a":1}
  out = out.replace(/,\s*(?=([}\]]))/g, "");

  // 4) Occasionally models print object commas on their own line or duplicate commas.
  //    Replace any sequence of ",\s*,+" with a single comma
  out = out.replace(/,\s*,+/g, ",");

  // 5) Trim whitespace
  out = out.trim();

  return out;
}

export function sanitizeAndParseJson(raw: string): any {
  // Fast path: raw parse (works for good JSON obj or array)
  try {
    return JSON.parse(raw);
  } catch (e) {
    // continue
  }

  // Try cleaned JSON
  const cleaned = sanitizeJsonString(raw);
  try {
    return JSON.parse(cleaned);
  } catch (e2) {
    // Try extracting either first {...} or [...] block
    const match = cleaned.match(/(\{[\s\S]*?\}|\[[\s\S]*?\])/);
    if (match) {
      const candidate = sanitizeJsonString(match[0]);
      try {
        return JSON.parse(candidate);
      } catch (e3) {
        // Last-ditch: try JSON5 which accepts trailing commas, single quotes, etc.
        try {
          return JSON5.parse(candidate);
        } catch (e4) {
          const err = new Error(
            `All parse attempts failed. JSON.parse errors: ${String(
              e2
            )} | ${String(e3)}. JSON5 error: ${String(e4)}`
          );
          (err as any).cleaned = candidate;
          throw err;
        }
      }
    } else {
      // No JSON-like block found; attempt JSON5 on cleaned full text
      try {
        return JSON5.parse(cleaned);
      } catch (e5) {
        const err = new Error(
          `Unable to parse model output as JSON or JSON5: ${String(e5)}`
        );
        (err as any).cleaned = cleaned;
        throw err;
      }
    }
  }
}

export function extractFirstBalancedJson(text: string): string | null {
  if (!text) return null;

  const len = text.length;
  let i = 0;

  while (i < len) {
    const ch = text[i];

    // find first opening brace or bracket
    if (ch !== "{" && ch !== "[") {
      i++;
      continue;
    }

    const opening = ch;
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let j = i; j < len; j++) {
      const c = text[j];

      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (c === "\\") {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = false;
        }
        continue;
      } else {
        if (c === '"') {
          inString = true;
          continue;
        }
        if (c === opening) {
          depth++;
          continue;
        }
        if (c === closing) {
          depth--;
          if (depth === 0) {
            // found matching close; return substring from i..j (inclusive)
            return text.slice(i, j + 1);
          }
          continue;
        }
        // other chars - ignore
      }
    }

    // if we get here, couldn't find a matching close for this opening char;
    // start searching for next opening char after i
    i++;
  }

  return null;
}

export function cleanDocxText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n") // collapse extra blank lines
    .replace(/\s{2,}/g, " ") // remove excessive spacing
    .replace(/•/g, "\n•") // ensure bullets start new lines
    .replace(/(EXPERIENCE)/i, "\n\n$1\n") // isolate key headers
    .replace(/([A-Z][A-Za-z]+ [A-Z][A-Za-z]+)(\s+)([A-Z][A-Za-z]+)/g, "$1\n$3") // split names/roles
    .trim();
}
