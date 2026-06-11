// Dev verification helper: drives the app headlessly and captures screenshots.
// Usage: node scripts/screenshot.mjs [baseUrl]
import puppeteer from "puppeteer-core";

const base = process.argv[2] ?? "http://localhost:3001";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-first-run", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1600,950"],
  defaultViewport: { width: 1600, height: 950 },
});

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

// 1. Operations view — let scenario mode settle and tiles load
await page.goto(base, { waitUntil: "networkidle2", timeout: 60_000 });
await new Promise((r) => setTimeout(r, 9000));
await page.screenshot({ path: "/tmp/varde-ops.png" });

// 2. Select the first event via keyboard (focus list, Enter)
const firstRow = await page.$("[data-event-id]");
if (firstRow) {
  await firstRow.focus();
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "/tmp/varde-selected.png" });
}

// 3. Design system page
await page.goto(`${base}/design-system`, {
  waitUntil: "networkidle2",
  timeout: 60_000,
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: "/tmp/varde-ds.png", fullPage: false });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
