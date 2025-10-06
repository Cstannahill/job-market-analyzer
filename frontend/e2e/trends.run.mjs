import { chromium } from "playwright-chromium";

// Simple E2E script to visit /trends, click the first skill card and capture screenshots
// Assumes dev server is running at http://localhost:5173

const URL = "http://localhost:5173/trends";
const viewports = [360, 412, 480, 768];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    for (const w of viewports) {
      const page = await context.newPage();
      await page.setViewportSize({ width: w, height: 800 });
      console.log(`Navigating to ${URL} at width ${w}`);
      await page.goto(URL, { waitUntil: "networkidle" });
      // wait for skill list to appear
      await page
        .waitForSelector(".skill-card", { timeout: 10000 })
        .catch(() => {});
      // click the first skill card
      const first = await page.$(".skill-card");
      if (first) {
        await first.click();
        // wait for detail panel content to render
        await page
          .waitForSelector(
            ".trends-side .card, .insight-panel, .skill-detail",
            { timeout: 10000 }
          )
          .catch(() => {});
      }

      const file = `./screenshots/trends-${w}.png`;
      console.log(`Capturing screenshot ${file}`);
      await page.screenshot({ path: file, fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
})();
