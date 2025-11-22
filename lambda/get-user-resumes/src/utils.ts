export function coerceInsights(raw: unknown): unknown | undefined {
  if (raw == null) return undefined;

  const renameThreeLine = (val: unknown): unknown => {
    if (Array.isArray(val)) {
      return val.map(renameThreeLine);
    }
    if (val && typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        const newKey = k === "3line" ? "threeLine" : k;
        out[newKey] = renameThreeLine(v);
      }
      return out;
    }
    return val;
  };

  if (typeof raw === "object") return raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return renameThreeLine(JSON.parse(trimmed));
      } catch (err) {
        console.error(err);
      }
    }

    const fixed = trimmed
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");
    try {
      return renameThreeLine(JSON.parse(fixed));
    } catch (err) {
      console.error(err);
    }
  }

  return undefined;
}
