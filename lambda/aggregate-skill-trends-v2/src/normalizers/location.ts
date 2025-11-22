const US_STATES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

export function parseLocation(input: string): {
  region?: string;
  country?: string;
} {
  if (!input) return {};
  // Examples: "Chicago, IL, US" | "Remote, US" | "Toronto, CA" | "Portugal"
  const parts = input
    .split(/[,\|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const up = parts.map((p) => p.toUpperCase());

  // Country: prefer last token if 2-letter
  let country = up.findLast((p) => /^[A-Z]{2}$/.test(p));
  if (!country) {
    // crude guesses
    if (up.some((p) => p.includes("UNITED STATES") || p === "USA"))
      country = "US";
    else if (up.some((p) => p === "UK" || p.includes("UNITED KINGDOM")))
      country = "GB";
  }

  let state: string | undefined;
  if (country === "US") {
    state = up.find((p) => US_STATES.has(p));
  }

  // Region codes:
  // - State-level: "US-IL"
  // - Country-level: "US" | "PT" | "CA"
  // - Global handled by caller ("GLOBAL")
  const region = country && state ? `${country}-${state}` : undefined;
  return { region, country };
}
