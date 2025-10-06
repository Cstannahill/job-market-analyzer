import { chromium } from "playwright-chromium";
import fs from "fs";
import path from "path";

const __dirname = path.resolve();

(async () => {
  const outDir = path.join(__dirname, "screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const widths = [360, 412, 480, 768];
  const url = process.env.URL || "http://localhost:5173/";

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(url, { waitUntil: "networkidle" });
    const outPath = path.join(outDir, `screenshot-${w}.png`);
    console.log("Capturing", outPath);
    await page.screenshot({ path: outPath, fullPage: true });
  }

  await browser.close();
  console.log("Screenshots saved in", outDir);
})();
