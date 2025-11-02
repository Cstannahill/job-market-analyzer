// src/lib/devFilter.ts
const DEV_PATTERNS: RegExp[] = [
  /\b(software|backend|front[\s-]?end|full[\s-]?stack|platform|mobile|web|cloud|security|data|ml|ai)\b/i,
  /\b(dev(eloper|ops)?|engineer(ing)?|programmer|architect|sre|qa)\b/i,
  /\b(sde|swe)\b/i, // common acronyms
  /\b(ios|android|react|node|python|golang|rust|java|c#|\.net)\b/i,
];

export function isDevRole(title: string): boolean {
  const t = title || "";
  return DEV_PATTERNS.some((rx) => rx.test(t));
}

export function sampleDropped(titles: string[], limit = 10): string[] {
  const out: string[] = [];
  for (const t of titles) {
    if (!isDevRole(t)) {
      out.push(t);
      if (out.length >= limit) break;
    }
  }
  return out;
}
