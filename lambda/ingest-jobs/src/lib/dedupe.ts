// lib/dedupe.ts
import crypto from "crypto";

const COMPANY_SUFFIXES =
  /\b(inc\.?|l\.l\.c\.|llc|ltd\.?|limited|corp\.?|corporation|co\.|company)\b/g;
const PUNCT = /[.,/#!$%^&*;:{}=\-_`~()]/g;

const COMPANY_ALIASES: Record<string, string> = {
  "meta platforms": "meta",
  "google llc": "google",
  alphabet: "google", // optional
};

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "us",
  usa: "us",
  "u.s.": "us",
  "u.s.a.": "us",
  us: "us",
  "united kingdom": "uk",
  "great britain": "uk",
  gb: "uk",
  uk: "uk",
  canada: "ca",
  ca: "ca",
};

const STATE_ABBR: Record<string, string> = {
  al: "al",
  ak: "ak",
  az: "az",
  ar: "ar",
  ca: "ca",
  co: "co",
  ct: "ct",
  de: "de",
  fl: "fl",
  ga: "ga",
  hi: "hi",
  id: "id",
  il: "il",
  in: "in",
  ia: "ia",
  ks: "ks",
  ky: "ky",
  la: "la",
  me: "me",
  md: "md",
  ma: "ma",
  mi: "mi",
  mn: "mn",
  ms: "ms",
  mo: "mo",
  mt: "mt",
  ne: "ne",
  nv: "nv",
  nh: "nh",
  nj: "nj",
  nm: "nm",
  ny: "ny",
  nc: "nc",
  nd: "nd",
  oh: "oh",
  ok: "ok",
  or: "or",
  pa: "pa",
  ri: "ri",
  sc: "sc",
  sd: "sd",
  tn: "tn",
  tx: "tx",
  ut: "ut",
  vt: "vt",
  va: "va",
  wa: "wa",
  wv: "wv",
  wi: "wi",
  wy: "wy",
  dc: "dc",
};

const STATE_NAMES: Record<string, string> = {
  california: "ca",
  "new york": "ny",
  illinois: "il",
  texas: "tx",
  washington: "wa",
  florida: "fl", // add as needed
};

export function normCompany(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase().trim();
  s = s.replace(PUNCT, " ").replace(/\s+/g, " ");
  s = s.replace(COMPANY_SUFFIXES, "").replace(/\s+/g, " ").trim();
  s = COMPANY_ALIASES[s] ?? s;
  return s;
}

export function normTitle(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase().trim();
  s = s.replace(/[\[\(].*?[\]\)]/g, " "); // drop [Remote], (Contract)
  s = s.replace(/-\s*[a-z0-9\s]+$/i, " "); // drop trailing team info: "- Reality Labs"
  s = s.replace(PUNCT, " ").replace(/\s+/g, " ").trim();
  return s;
}

export function normDate(isoOrEpoch?: string | number): string {
  if (!isoOrEpoch) return "";
  const d =
    typeof isoOrEpoch === "number"
      ? new Date(isoOrEpoch)
      : new Date(isoOrEpoch);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cleanToken(s?: string) {
  return (s || "")
    .toLowerCase()
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normCountryToken(s?: string) {
  const t = cleanToken(s);
  return COUNTRY_ALIASES[t] || t;
}

function normRegionToken(s?: string) {
  const t = cleanToken(s);
  if (!t) return "";
  if (STATE_ABBR[t]) return t; // already an abbr
  if (STATE_NAMES[t]) return STATE_NAMES[t]; // full name -> abbr
  // Sometimes strings like "California, United States" come in; try first word
  const first = t.split(" ")[0];
  if (STATE_ABBR[first]) return first;
  return t;
}

export function normLocation(
  raw?: string,
  city?: string,
  region?: string,
  country?: string
): { token: string; city?: string; region?: string; country?: string } {
  // Prefer structured inputs if present
  if (city || region || country) {
    const c = cleanToken(city);
    const r = normRegionToken(region);
    const co = normCountryToken(country) || "us";
    const token = [c, r, co].filter(Boolean).join(",");
    return {
      token,
      city: c || undefined,
      region: r || undefined,
      country: co || undefined,
    };
  }

  // Parse common raw patterns like "San Francisco, CA, US" or "Remote - United States"
  const r = (raw || "").replace(/\u00A0/g, " "); // nbsp
  const lowered = r.toLowerCase().trim();

  // Split on commas first, fall back to hyphen
  let parts = lowered
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 1 && lowered.includes("-")) {
    parts = lowered
      .split("-")
      .map((p) => p.trim())
      .filter(Boolean);
  }

  let c = "",
    s = "",
    co = "";

  if (parts.length >= 3) {
    c = cleanToken(parts[0]);
    s = normRegionToken(parts[1]);
    co = normCountryToken(parts[2]);
  } else if (parts.length === 2) {
    // e.g., "San Francisco, CA" (assume US if unspecified)
    c = cleanToken(parts[0]);
    s = normRegionToken(parts[1]);
    co = "us";
  } else {
    // One token: could be "Remote - United States" already split above, or just a country
    // Try to detect US/UK/CA etc.
    const countryGuess = normCountryToken(lowered);
    if (countryGuess && COUNTRY_ALIASES[countryGuess]) {
      co = COUNTRY_ALIASES[countryGuess];
    } else {
      c = cleanToken(raw);
      co = "us";
    }
  }

  const token = [c, s, co].filter(Boolean).join(",");
  return {
    token,
    city: c || undefined,
    region: s || undefined,
    country: co || undefined,
  };
}

export function sha1(s: string): string {
  return crypto.createHash("sha1").update(s, "utf8").digest("hex");
}

export function makeHash(opts: {
  company: string;
  title: string;
  locationToken: string;
  postedDate?: string;
}): string {
  const key = `${opts.company}|${opts.title}|${opts.locationToken}|${
    opts.postedDate || ""
  }`;
  return sha1(key);
}

// Convenience: build from raw provider fields
export function hashFromProviderFields(input: {
  company?: string;
  title?: string;
  locationRaw?: string;
  city?: string;
  region?: string;
  country?: string;
  postedDate?: string | number;
}) {
  const company = normCompany(input.company || "");
  const title = normTitle(input.title || "");
  const date = normDate(input.postedDate);
  const loc = normLocation(
    input.locationRaw,
    input.city,
    input.region,
    input.country
  );
  const postingHash = makeHash({
    company,
    title,
    locationToken: loc.token,
    postedDate: date,
  });
  return {
    postingHash,
    company,
    title,
    date,
    locationToken: loc.token,
    city: loc.city,
    region: loc.region,
    country: loc.country,
  };
}

// Optional: description fingerprint
export function descSig(description?: string): string {
  if (!description) return "";
  const s = description.toLowerCase().replace(/\s+/g, " ").slice(0, 1500);
  return sha1(s);
}
