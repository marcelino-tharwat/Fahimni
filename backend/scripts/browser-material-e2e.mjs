/**
 * Playwright browser E2E for multi-file material download UI.
 * Requires backend :3000 and frontend :5173.
 */
import { chromium } from "playwright";

const FRONTEND = process.env.FRONTEND_URL ?? "http://127.0.0.1:5174";
const LESSON_ID = "1bd1585a-4edf-5ee8-880f-268b13dbde36";
const PW = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const apiLog = [];

  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/lesson-materials/") || url.includes("/content/student/lessons/")) {
      apiLog.push({ url: url.split("?")[0], status: res.status() });
    }
  });

  await page.goto(`${FRONTEND}/auth`);
  await page.getByPlaceholder(/email|البريد|بريد/i).first().fill("chem.student01@fahimni.test");
  await page.getByPlaceholder(/password|كلمة/i).first().fill(PW);
  await page.getByRole("button", { name: /login|تسجيل|دخول/i }).click();
  await page.waitForURL(/student/, { timeout: 20000 });

  await page.goto(`${FRONTEND}/student/lessons/${LESSON_ID}`);
  await page.waitForLoadState("networkidle");

  const names = ["ملخص الدرس", "أوراق عمل", "مراجع إضافية"];
  const visible = {};
  for (const n of names) visible[n] = (await page.getByText(n, { exact: false }).count()) > 0;

  const downloadButtons = page.getByRole("button", { name: /download|تحميل/i });
  const previewButtons = page.getByRole("button", { name: /preview|معاينة/i });
  const downloadCount = await downloadButtons.count();
  const previewCount = await previewButtons.count();

  const beforeDownloaded = await page.getByText(/downloaded|تم التحميل|Downloaded/i).count();
  const beforeNotDownloaded = await page.getByText(/not downloaded|لم يتم/i).count();

  if (previewCount >= 2) {
    await previewButtons.nth(1).click();
    await page.waitForTimeout(1200);
  }

  await page.reload();
  await page.waitForLoadState("networkidle");

  let downloadEvent = false;
  let suggestedFilename = null;
  if (downloadCount >= 3) {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      downloadButtons.nth(2).click(),
    ]);
    if (dl) {
      downloadEvent = true;
      suggestedFilename = dl.suggestedFilename();
      const path = await dl.path();
      if (path) {
        const fs = await import("node:fs/promises");
        const buf = await fs.readFile(path);
        downloadEvent = buf.subarray(0, 5).toString() === "%PDF-";
      }
    }
  }

  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForLoadState("networkidle");

  const afterDownloaded = await page.getByText(/downloaded|تم التحميل|Downloaded/i).count();

  console.log(
    JSON.stringify(
      {
        visibleNames: visible,
        downloadButtonCount: downloadCount,
        previewButtonCount: previewCount,
        beforeDownloadedLabels: beforeDownloaded,
        beforeNotDownloadedLabels: beforeNotDownloaded,
        afterDownloadedLabels: afterDownloaded,
        downloadEventPdf: downloadEvent,
        suggestedFilename,
        apiLog,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
