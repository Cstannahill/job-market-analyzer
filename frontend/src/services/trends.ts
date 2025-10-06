// Minimal trends service and normalization helpers
import axios from "axios";

// API gateway base for trends endpoints. Prefer VITE_TRENDS_API_URL, fall back to VITE_API_URL.
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod";

const TRENDS_API = `${API_URL}/trends`;
export type SkillTrend = {
  id: string;
  pk: string;
  sk: string;
  skill: string;
  region: string;
  seniority: string;
  type?: string;
  count: number;
  relativeDemand: number;
  remotePercentage: number;
  avgSalary?: number | null;
  lastUpdated?: string;
  associatedRoles: string[];
  cooccurringSkills: Record<string, number>;
  topIndustries: string[];
};

type LambdaProxy = { statusCode?: number; body?: string };
type CommonPayload = { data?: unknown[]; items?: unknown[] };
type ApiResponse =
  | LambdaProxy
  | CommonPayload
  | unknown[]
  | Record<string, unknown>;

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

export function normalizeRow(row: Record<string, unknown>): SkillTrend {
  const pk = String((row.PK || row.pk) ?? "");
  const sk = String((row.SK || row.sk) ?? "");
  const skill = String(row.skill ?? "");
  const region = String(row.region ?? "");
  const seniority = String(row.seniority_level ?? row.seniority ?? "");

  const associatedRolesCandidate =
    row.associatedRoles ?? row.associated_roles ?? "[]";
  const associatedRoles = Array.isArray(associatedRolesCandidate)
    ? (associatedRolesCandidate as string[])
    : safeJsonParse<string[]>(String(associatedRolesCandidate), []);

  const cooccurringSkills = parseDynamoMapCounts(
    row.cooccurringSkills ?? row.cooccurring_skills ?? {}
  );
  const topIndustries = parseTopIndustries(
    row.topIndustries ?? row.top_industries ?? []
  );

  const count = Number((row.count ?? 0) as unknown as number) || 0;
  const relativeDemand =
    Number(
      (row.relativeDemand ?? row.relative_demand ?? 0) as unknown as number
    ) || 0;
  const remotePercentage = normalizeRemotePercentage(
    row.remotePercentage ?? row.remote_percentage ?? 0
  );

  const avgSalaryRaw = row.avgSalary ?? row.avg_salary;
  const avgSalary =
    avgSalaryRaw === null ||
    avgSalaryRaw === undefined ||
    String(avgSalaryRaw) === "null"
      ? null
      : Number(avgSalaryRaw as unknown as number);

  const id = `${pk}|${sk}`;

  return {
    id,
    pk,
    sk,
    skill,
    region,
    seniority,
    type: String(row.skill_type ?? row.type ?? undefined) || undefined,
    count,
    relativeDemand,
    remotePercentage,
    avgSalary: Number.isNaN(avgSalary as number)
      ? null
      : (avgSalary as number | null),
    lastUpdated: (row.lastUpdated ?? row.last_updated) as string | undefined,
    associatedRoles: Array.isArray(associatedRoles) ? associatedRoles : [],
    cooccurringSkills,
    topIndustries,
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
