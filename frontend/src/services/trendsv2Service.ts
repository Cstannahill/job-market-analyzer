import type {
  GetTopTechnologiesResponse,
  GetRisingTechnologiesResponse,
  TechnologyDetailResponse,
  TrendsOverviewResponse,
  Region,
  Period,
} from "@job-market-analyzer/types/trendsv2";

const BASE = import.meta.env.VITE_TRENDSV2_API_URL ?? "";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function getTop(params: {
  region: Region;
  period: Period;
  limit?: number;
}) {
  const { region, period, limit = 40 } = params;
  const u = new URL(`${BASE}/v2/trends/technologies/top`);
  u.searchParams.set("region", region);
  u.searchParams.set("period", period);
  u.searchParams.set("limit", String(limit));
  const data = await j<GetTopTechnologiesResponse>(await fetch(u));
  return data.data;
}

export async function getRising(params: {
  region: Region;
  period: Period;
  limit?: number;
}) {
  const { region, period, limit = 20 } = params;
  const u = new URL(`${BASE}/v2/trends/technologies/rising`);
  u.searchParams.set("region", region);
  u.searchParams.set("period", period);
  u.searchParams.set("limit", String(limit));
  const data = await j<GetRisingTechnologiesResponse>(await fetch(u));
  return data.data;
}

export async function getTechDetail(params: {
  name: string;
  region: Region;
  period: Period;
}) {
  const { name, region, period } = params;
  const u = new URL(`${BASE}/v2/trends/technology/${encodeURIComponent(name)}`);
  u.searchParams.set("region", region);
  u.searchParams.set("period", period);
  return j<TechnologyDetailResponse>(await fetch(u));
}

export async function getOverview(params: {
  region: Region;
  period: Period;
  limit?: number;
}) {
  const { region, period, limit = 10 } = params;
  const u = new URL(`${BASE}/v2/trends/overview`);
  u.searchParams.set("region", region);
  u.searchParams.set("period", period);
  u.searchParams.set("limit", String(limit));
  return j<TrendsOverviewResponse>(await fetch(u));
}

export async function getWeeks() {
  const url = new URL(`${BASE}/v2/trends/weeks`);
  return j<string[]>(await fetch(url));
}
