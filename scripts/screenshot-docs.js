const { chromium } = require('playwright');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshotPage(page, url, path, options = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (options.beforeShot) {
    await options.beforeShot(page);
  }
  await wait(1500);
  await page.screenshot({ path, fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

  const baseUrl = process.env.DBT_DOCS_URL || 'http://127.0.0.1:8081';

  // Landing page
  await screenshotPage(
    page,
    baseUrl,
    'assets/dbt-docs-home.png'
  );

  // Try to open graph from main overview and capture the analytics-focused view.
  await screenshotPage(
    page,
    baseUrl,
    'assets/dbt-docs-graph.png',
    {
      beforeShot: async (page) => {
        // Adjust selectors if your docs UI differs slightly.
        const graphButton = page.locator('button:has-text("Graph"), [aria-label*="Graph"], text=Graph').first();
        if (await graphButton.count()) {
          await graphButton.click();
          await wait(2000);
        }
      }
    }
  );

  // Capture object pages by searching for object names in the DOM and clicking them.
  // If these selectors do not match your local docs build, we can refine them once you test.
  async function captureModel(modelName, outputPath) {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const modelLink = page.locator(`text=${modelName}`).first();
    await modelLink.click();
    await wait(2000);
    await page.screenshot({ path: outputPath, fullPage: true });
  }

  await captureModel('int_lead_engagement', 'assets/dbt-int-lead-engagement.png');
  await captureModel('fct_lead_kpis_daily', 'assets/dbt-fct-lead-kpis-daily.png');

  await browser.close();
})();