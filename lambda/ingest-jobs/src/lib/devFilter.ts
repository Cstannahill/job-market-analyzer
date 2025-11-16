// src/lib/devFilter.ts

// Strong software signals (stack/discipline)
const SOFTWARE_SIGNALS =
  /\b(software|front[\s-]?end|back[\s-]?end|full[\s-]?stack|web|mobile|cloud|platform|devops|sre|qa|test|quality|data|ml|ai|application|apps?)\b/i;

// Languages / frameworks / runtimes
const LANG_FRAMEWORKS =
  /\b(typescript|javascript|react(?:\s+native)?|next\.?js|node\.?js?|python|java|kotlin|scala|go|golang|rust|c\+\+|c#|\.net|php|ruby|rails|django|spring|swift|objective[\s-]?c|angular|vue|svelte|flutter)\b/i;

// Role words that imply software when paired with signals
const ROLE_WORDS =
  /\b(dev(eloper|ops)?|engineer(ing)?|programmer|architect|sre|qa|tester|sde|swe)\b/i;

// Classic non-software domains (early reject unless software signals are present)
const NON_DEV_EXCLUSIONS = [
  // disciplines
  /\b(power|electrical|electronics?|rf|analog|mixed[-\s]?signal|mechanical|civil|structural|chemical|biomedical|materials?|industrial|process|manufacturing|hvac|petroleum|mining|nuclear|aerospace|automotive|flight test)\b/i,
  // hardware keywords
  /\b(hardware|pcb|pcba|board\s*layout|layout|asic|fpga|vlsi|rtl|semiconductor|verilog|vhdl|emc|emi)\b/i,
];

// Titles that are software-ish though hardware adjacent; keep them unless excluded above
// If you want to *exclude* firmware/embedded by default, remove them from SOFTWARE_QUALIFIERS.
const SOFTWARE_QUALIFIERS =
  /\b(software|firmware|embedded|controls\s+software|applications?)\b/i;

export function isDevRole(title: string): boolean {
  const t = (title || "").trim();

  if (!t) return false;

  // If it looks like a non-software engineering field AND lacks any explicit software signal, reject.
  const hitsExclusion = NON_DEV_EXCLUSIONS.some((rx) => rx.test(t));
  const hasSoftwareQualifier = SOFTWARE_QUALIFIERS.test(t);
  const hasLangOrFramework = LANG_FRAMEWORKS.test(t);
  const hasSoftwareSignal = SOFTWARE_SIGNALS.test(t);
  const hasRoleWord = ROLE_WORDS.test(t);

  if (
    hitsExclusion &&
    !(hasSoftwareQualifier || hasLangOrFramework || hasSoftwareSignal)
  ) {
    return false; // e.g., "Senior Power Electronics Engineer"
  }

  // Positive logic: require either (software signal) OR (lang/framework) with a role word.
  if (hasSoftwareSignal && hasRoleWord) return true; // e.g., "Backend Engineer", "Cloud QA Engineer"
  if (hasLangOrFramework && hasRoleWord) return true; // e.g., "React Developer", "Java SWE"
  if (hasLangOrFramework && !hitsExclusion) return true; // e.g., "React/TypeScript Contractor"
  if (/developer|programmer|sde|swe/i.test(t) && !hitsExclusion) return true;

  return false;
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
