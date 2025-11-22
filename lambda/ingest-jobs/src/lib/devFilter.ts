const SOFTWARE_SIGNALS =
  /\b(software|front[\s-]?end|back[\s-]?end|full[\s-]?stack|web|mobile|cloud|platform|devops|sre|qa|test|quality|data|ml|ai|application|apps?)\b/i;

const LANG_FRAMEWORKS =
  /\b(typescript|javascript|react(?:\s+native)?|next\.?js|node\.?js?|python|java|kotlin|scala|go|golang|rust|c\+\+|c#|\.net|php|ruby|rails|django|spring|swift|objective[\s-]?c|angular|vue|svelte|flutter)\b/i;

const ROLE_WORDS =
  /\b(dev(eloper|ops)?|engineer(ing)?|programmer|architect|sre|qa|tester|sde|swe)\b/i;

const NON_DEV_EXCLUSIONS = [
  /\b(power|electrical|electronics?|rf|rfics?|analog|mixed[-\s]?signal|mechanical|civil|structural|chemical|biomedical|materials?|industrial|process|manufacturing|hvac|petroleum|mining|nuclear|mechanic|aerospace|automotive|mechanical|flight|propulsion|spaceport|ground\s*station|gnc|adcs|pressure\s*vessel|failure\s+analysis|landscape|product\s+design|automation\s+controls?)\b/i,

  /\b(hardware|pcb|pcba|board\s*layout|layout|asic|fpga|vlsi|rtl|semiconductor|verilog|vhdl|emc|emi)\b/i,
];

const SOFTWARE_QUALIFIERS =
  /\b(software|firmware|embedded|controls\s+software|applications?)\b/i;

export function isDevRole(title: string): boolean {
  const t = (title || "").trim();

  if (!t) return false;

  const hitsExclusion = NON_DEV_EXCLUSIONS.some((rx) => rx.test(t));
  const hasSoftwareQualifier = SOFTWARE_QUALIFIERS.test(t);
  const hasLangOrFramework = LANG_FRAMEWORKS.test(t);
  const hasSoftwareSignal = SOFTWARE_SIGNALS.test(t);
  const hasRoleWord = ROLE_WORDS.test(t);

  if (
    hitsExclusion &&
    !(hasSoftwareQualifier || hasLangOrFramework || hasSoftwareSignal)
  ) {
    return false;
  }

  if (hasSoftwareSignal && hasRoleWord) return true;
  if (hasLangOrFramework && hasRoleWord) return true;
  if (hasLangOrFramework && !hitsExclusion) return true;
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
