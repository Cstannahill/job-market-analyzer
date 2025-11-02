// src/scripts/find-boards.ts
import "dotenv/config";

const BRANDS = (
  process.env.BRANDS ||
  "vercel,ramp,retool,datadog,plaid,stripe,doordash,shopify,openai,anthropic,figma,atlassian,dropbox,linear,robinhood,asana,notion,airbnb,netflix,uber,lyft,circle,brex,block,square,coinbase,reddit,okta,cloudflare,hashicorp,twilio"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function hasGreenhouse(slug: string) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const r = await fetch(url, { headers: { "user-agent": "JMA/1.0" } });
  return r.ok ? slug : null;
}
async function hasLever(slug: string) {
  const url = `https://api.lever.co/v0/postings/${slug}?limit=1&mode=json`;
  const r = await fetch(url, { headers: { "user-agent": "JMA/1.0" } });
  return r.ok ? slug : null;
}

async function main() {
  const gh: string[] = [];
  const lv: string[] = [];
  for (const b of BRANDS) {
    const [g, l] = await Promise.allSettled([hasGreenhouse(b), hasLever(b)]);
    if (g.status === "fulfilled" && g.value) gh.push(g.value);
    if (l.status === "fulfilled" && l.value) lv.push(l.value);
  }
  console.log("GREENHOUSE:", gh.join(","));
  console.log("LEVER:", lv.join(","));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
