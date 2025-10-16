// Minimal trends service and normalization helpers
import axios from "axios";
import type {
  SkillTrend,
  LambdaProxy,
  CommonPayload,
  ApiResponse,
} from "@/shared-types";

const API_URL = import.meta.env.VITE_API_URL;

const TRENDS_API = `${API_URL}/trends`;

function safeJsonParse<T = unknown>(
  input: string | null | undefined,
  fallback: T
): T {
  if (input === undefined || input === null) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch (err) {
    // keep the error visible for debugging
    console.debug("safeJsonParse failed:", (err as Error).message);
    return fallback;
  }
}

function parseDynamoMapCounts(input: unknown): Record<string, number> {
  if (!input) return {};
  const parsed =
    typeof input === "string"
      ? safeJsonParse<Record<string, unknown>>(input, {})
      : (input as Record<string, unknown>);
  const out: Record<string, number> = {};
  for (const k of Object.keys(parsed)) {
    const v = parsed[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (o.N !== undefined) out[k] = Number(o.N);
      else if (o.S !== undefined) out[k] = Number(o.S) || 0;
      else out[k] = Number(o as unknown as number) || 0;
    } else {
      out[k] = Number(v as unknown as number) || 0;
    }
  }
  return out;
}

function parseTopIndustries(input: unknown): string[] {
  if (!input) return [];
  const parsed =
    typeof input === "string"
      ? safeJsonParse<unknown[]>(input, [])
      : (input as unknown[]);
  return parsed
    .map(
      (p) =>
        (p && typeof p === "object" && "S" in (p as Record<string, unknown>)
          ? (p as Record<string, unknown>).S
          : p) as string | undefined
    )
    .filter(Boolean) as string[];
}

function normalizeRemotePercentage(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val as unknown as number);
  if (Number.isNaN(n)) return 0;
  if (n > 0 && n <= 1) return Math.round(n * 100);
  return Math.round(n);
}
function parseKeyPairs(key?: string) {
  if (!key) return {};
  const parts = String(key)
    .split("#")
    .map((p) => p.trim())
    .filter(Boolean);
  const out: Record<string, string> = {};
  for (let i = 0; i < parts.length; i += 2) {
    const k = parts[i]?.toLowerCase();
    const v = parts[i + 1];
    if (k && v) out[k] = v;
  }
  return out;
}

/** Clean and normalize messy token strings into tokens */
function cleanTokenString(input?: unknown): string[] {
  if (input == null) return [];
  // If it's already an array, flatten + normalize items
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map(String)
          .flatMap((s) => cleanTokenString(s))
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, 10);
  }

  let s = String(input);

  // Common patterns: '#skill|#python|region#other' or 'skill#python' or 'python,java'
  // Replace separators with comma
  s = s.replace(/[|/;]+/g, ",");
  // Remove stray '#' and common key words
  s = s.replace(/#/g, ",");
  // Remove 'skill'/'region'/'seniority' tokens that occur alone
  s = s.replace(/\b(skill|region|seniority|type|pk|sk)\b/gi, "");
  // Split on commas and whitespace
  const tokens = s
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.toLowerCase() !== "null");

  // dedupe, keep first N tokens
  return Array.from(new Set(tokens)).slice(0, 10);
}

/** Clean a possible dynamo map of counts (cooccurringSkills) */

export function normalizeRow(row: Record<string, unknown>): SkillTrend {
  const pk = String((row.PK || row.pk) ?? "");
  const sk = String((row.SK || row.sk) ?? "");

  // Prefer explicit fields, fallback to parsed PK/SK pairs
  const pkPairs = parseKeyPairs(pk);
  const skPairs = parseKeyPairs(sk);

  // skill name: prefer explicit field, else extract from parsed pairs (skill key)
  let rawSkill = String(
    row.skill ?? row.Skill ?? pkPairs.skill ?? skPairs.skill ?? ""
  );
  if (!rawSkill && (pkPairs.skill || skPairs.skill)) {
    rawSkill = pkPairs.skill || skPairs.skill || rawSkill;
  }

  // Remove stray prefixes like "skill#" in skill
  // If skill looks like "skill#python" => extract last segment
  if (rawSkill.includes("#")) {
    const parts = rawSkill
      .split("#")
      .map((p) => p.trim())
      .filter(Boolean);
    rawSkill = parts.length ? parts[parts.length - 1] : rawSkill;
  }

  // Region / seniority — explicit preferred, then parsed pairs
  let region =
    String(
      row.region ?? row.Region ?? skPairs.region ?? pkPairs.region ?? ""
    ) || "";
  let seniority =
    String(
      row.seniority ??
        row.seniority_level ??
        row.Seniority ??
        skPairs.seniority ??
        pkPairs.seniority ??
        ""
    ) || "";

  /// Clean token lists for industries, tags etc.
  // Use the original helpers (pre-existing in the file) so they're not unused.
  const topIndustries = parseTopIndustries(
    row.topIndustries ?? row.top_industries ?? row.industries ?? []
  );

  // prefer the Dynamo map parser already defined earlier
  const cooccurringSkills = parseDynamoMapCounts(
    row.cooccurringSkills ?? row.cooccurring_skills ?? {}
  );

  const count = Number(row.count ?? row.Count ?? 0) || 0;

  // use the normalize helper you already defined
  const remotePercentage = normalizeRemotePercentage(
    row.remotePercentage ?? row.remote_percentage ?? 0
  );
  const avgSalaryRaw = row.avgSalary ?? row.avg_salary ?? null;
  const avgSalary = avgSalaryRaw == null ? null : Number(avgSalaryRaw) || null;

  const id = `${pk}|${sk}`;

  // Final small cleanups for region and seniority tokens
  region = cleanTokenString(region)[0] ?? region ?? "global";
  seniority = cleanTokenString(seniority)[0] ?? seniority ?? "all";

  return {
    id,
    pk,
    sk,
    skill: rawSkill,
    region,
    seniority,
    count,
    remotePercentage,
    avgSalary,
    cooccurringSkills,
    topIndustries,
    // copy any other fields your SkillTrend expects, using cleaned values
  } as SkillTrend;
}

// Helper type guards
function isLambdaProxy(obj: unknown): obj is LambdaProxy {
  return (
    !!obj &&
    typeof obj === "object" &&
    "statusCode" in (obj as Record<string, unknown>)
  );
}

function extractPayload(payload: ApiResponse): unknown {
  if (isLambdaProxy(payload)) {
    const body = payload.body;
    if (typeof body === "string") {
      return safeJsonParse<unknown>(body, payload as unknown);
    }
    return payload as unknown;
  }
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object")
    return payload as Record<string, unknown>;
  return payload;
}

async function fetchJson(path: string): Promise<unknown> {
  const url = TRENDS_API
    ? `${TRENDS_API}${path.startsWith("/") ? path : "/" + path}`
    : path;

  try {
    const res = await axios.get(url);
    let payload: ApiResponse = res.data as ApiResponse;
    payload = extractPayload(payload) as ApiResponse;
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object") {
      const obj = payload as CommonPayload & Record<string, unknown>;
      if (Array.isArray(obj.data) && obj.data.length) return obj.data;
      if (Array.isArray(obj.items) && obj.items.length) return obj.items;
      return obj;
    }
    return payload;
  } catch (err) {
    // ensure the caught error is used to satisfy linter rules and for debugging
    console.debug(
      "Axios request failed for",
      path,
      (err as Error).message ?? err
    );
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error " + res.status);
  let payloadJson: unknown = await res.json();
  if (isLambdaProxy(payloadJson)) {
    payloadJson = safeJsonParse<unknown>(
      String((payloadJson as LambdaProxy).body),
      payloadJson
    );
  }
  if (Array.isArray(payloadJson)) return payloadJson;
  if (payloadJson && typeof payloadJson === "object") {
    const obj = payloadJson as CommonPayload & Record<string, unknown>;
    if (Array.isArray(obj.data) && obj.data.length) return obj.data;
    if (Array.isArray(obj.items) && obj.items.length) return obj.items;
    return obj;
  }
  return payloadJson;
}

export async function fetchTop(
  params: { region?: string; seniority?: string; limit?: number } = {}
) {
  const qs = new URLSearchParams();
  if (params.region) qs.set("region", params.region);
  if (params.seniority) qs.set("seniority", params.seniority);
  if (params.limit) qs.set("limit", String(params.limit));
  // Use the deployed API under the shared API gateway. Do not include an extra '/api' prefix.
  // If a region is provided, call the region endpoint; otherwise fall back to technology endpoint.
  const path = params.region
    ? `/region?${qs.toString()}`
    : `/technology?${qs.toString()}`;
  const data = await fetchJson(path);
  const arr: unknown[] = Array.isArray(data)
    ? (data as unknown[])
    : data &&
      typeof data === "object" &&
      "data" in (data as Record<string, unknown>)
    ? ((data as Record<string, unknown>).data as unknown[])
    : [];
  return arr.map((r: unknown) => normalizeRow(r as Record<string, unknown>));
}

export async function fetchSkill(skill: string) {
  // Use the skill detail path as a path parameter on the trends resource
  const path = `/skill/${encodeURIComponent(skill)}`;
  const data = await fetchJson(path);
  const arr: unknown[] = Array.isArray(data)
    ? (data as unknown[])
    : data &&
      typeof data === "object" &&
      "data" in (data as Record<string, unknown>)
    ? ((data as Record<string, unknown>).data as unknown[])
    : [];
  return arr.map((r: unknown) => normalizeRow(r as Record<string, unknown>));
}

export default { normalizeRow, fetchTop, fetchSkill };
