type TopRole = {
  title: string;
  why: string;
  fitScore: number;
  evidence?: string[];
};
type Output = {
  summary?: any;
  strengths?: any[];
  gaps?: any[];
  skills?: { technical?: any[]; soft?: any[] };
  topRoles?: TopRole[];
  achievements?: any[];
  resumeEdits?: { improvedBullets?: { old?: string | null; new: string }[] };
  atsAndFormat?: { isATSFriendly: boolean; recommendations: string[] };
  confidence?: "high" | "medium" | "low";
};

export function calibrateResumeInsights(
  out: Output,
  opts: { years: number; hasLeadershipSignals: boolean }
): Output {
  const MIN_MID = 3,
    MIN_SENIOR = 5;

  const requireEvidence = (r: TopRole) => {
    const ev = r.evidence?.filter(Boolean) ?? [];
    if (ev.length < 2) r.fitScore = Math.max(0, Math.round(r.fitScore - 25));
  };

  if (Array.isArray(out.topRoles)) {
    out.topRoles = out.topRoles.map((r) => {
      const title = r.title.toLowerCase();

      if (opts.years < MIN_MID && title.includes("senior")) {
        r.title = r.title.replace(/senior/i, "Junior");
        r.fitScore = Math.min(r.fitScore, 55);
      } else if (opts.years < MIN_SENIOR && title.includes("senior")) {
        r.title = r.title.replace(/senior/i, "Mid-level");
        r.fitScore = Math.min(r.fitScore, opts.hasLeadershipSignals ? 68 : 62);
      }
      requireEvidence(r);

      if (r.fitScore > 92) r.fitScore = 92;
      if (r.fitScore < 0) r.fitScore = 0;
      return r;
    });
  }

  const hasPlaceholders =
    JSON.stringify(out).match(/\bX%|100% reduction|TBD|YYY\b/i) != null;
  if (hasPlaceholders) out.confidence = "medium";

  const ats = out.atsAndFormat ?? { isATSFriendly: true, recommendations: [] };
  if (hasPlaceholders) {
    ats.isATSFriendly = false;
    ats.recommendations.push(
      "Replace placeholders with real metrics or remove."
    );
  }
  out.atsAndFormat = ats;

  return out;
}
