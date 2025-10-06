import { chromium } from "playwright-chromium";
import fs from "fs";
import path from "path";

// Generic screenshot runner
// Usage: run with node from frontend/ folder: node e2e/screenshot-all.mjs
// Ensure dev server is running at BASE_URL

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const ROUTES = ["/", "/trends"];
const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-412", width: 412, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
];
const OUT_DIR = path.resolve(process.cwd(), "screenshots");

async function ensureOut() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  await ensureOut();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    for (const route of ROUTES) {
      const url = new URL(route, BASE_URL).toString();
      for (const v of VIEWPORTS) {
        const page = await context.newPage();
        await page.setViewportSize({ width: v.width, height: v.height });
        console.log(`Navigating ${url} at ${v.name}`);
        await page.goto(url, { waitUntil: "networkidle" });
        // small wait for animations and charts
        await page.waitForTimeout(500);
        // click first skill card on trends page to reveal details
        if (route === "/trends") {
          try {
            await page.waitForSelector(".skill-card", { timeout: 5000 });
            const first = await page.$(".skill-card");
            if (first) await first.click();
            await page.waitForTimeout(500);
          } catch (e) {
            // ignore if not present
          }
        }

        const filename = `${route.replace(/\//g, "_") || "home"}-${v.name}.png`;
        const out = path.join(OUT_DIR, filename);
        console.log(`Capturing ${out}`);
        await page.screenshot({ path: out, fullPage: true });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export default run;
