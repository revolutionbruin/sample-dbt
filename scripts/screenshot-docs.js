const { chromium } = require('playwright');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickIfVisible(locator) {
  const count = await locator.count();
  if (!count) return false;

  const first = locator.first();
  if (await first.isVisible()) {
    await first.click();
    return true;
  }

  return false;
}

async function screenshotPage(page, url, path, options = {}) {
  await page.goto(url, { waitUntil: 'networkidle' });

  if (options.beforeShot) {
    await options.beforeShot(page);
  }

  await wait(1500);
  await page.screenshot({ path, fullPage: true });
}

async function clickGraphButton(page) {
  if (await clickIfVisible(page.getByRole('button', { name: /graph/i }))) {
    console.log('Clicked graph via getByRole');
    return true;
  }

  if (await clickIfVisible(page.getByText('Graph', { exact: true }))) {
    console.log('Clicked graph via getByText');
    return true;
  }

  if (await clickIfVisible(page.locator('[aria-label*="Graph"]'))) {
    console.log('Clicked graph via aria-label');
    return true;
  }

  console.log('Graph button not found');
  return false;
}

async function captureModel(page, baseUrl, modelName, outputPath) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const modelLink = page.getByText(modelName, { exact: true }).first();
  await modelLink.click();

  await wait(2000);
  await page.screenshot({ path: outputPath, fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 }
  });

  const baseUrl = process.env.DBT_DOCS_URL || 'http://127.0.0.1:8081';

  try {
    await screenshotPage(page, baseUrl, 'assets/dbt-docs-home.png');

    await screenshotPage(page, baseUrl, 'assets/dbt-docs-graph.png', {
      beforeShot: async (page) => {
        const clicked = await clickGraphButton(page);
        if (clicked) {
          await wait(2000);
        }
      }
    });

    await captureModel(
      page,
      baseUrl,
      'int_lead_engagement',
      'assets/dbt-int-lead-engagement.png'
    );

    await captureModel(
      page,
      baseUrl,
      'fct_lead_kpis_daily',
      'assets/dbt-fct-lead-kpis-daily.png'
    );
  } finally {
    await browser.close();
  }
})();