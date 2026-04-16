const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function loadManifest() {
  const candidates = [
    path.join(process.cwd(), 'target', 'manifest.json'),
    path.join(process.cwd(), 'leads_metrics', 'target', 'manifest.json')
  ];

  const manifestPath = findFirstExistingPath(candidates);

  if (!manifestPath) {
    throw new Error(
      `Could not find manifest.json. Checked:\n${candidates.join('\n')}`
    );
  }

  console.log(`Using manifest at: ${manifestPath}`);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function getModelUniqueId(manifest, modelName) {
  const models = Object.values(manifest.nodes || {})
    .filter((node) => (node.unique_id || '').startsWith('model.'))
    .map((node) => ({
      name: node.name,
      unique_id: node.unique_id
    }));

  console.log(
    'Available models:',
    models.map((m) => `${m.name} -> ${m.unique_id}`).join(', ')
  );

  const match = models.find((m) => m.name === modelName);

  if (!match) {
    throw new Error(`Model not found in manifest: ${modelName}`);
  }

  return match.unique_id;
}

async function gotoDocs(page, url) {
  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await wait(4000);
}

async function screenshot(page, file) {
  await page.screenshot({ path: file, fullPage: true });
  console.log(`Saved: ${file}`);
}

async function openOverviewGraph(page) {
  const selectors = [
    '[title="View Lineage Graph"]',
    '[data-original-title="View Lineage Graph"]',
    '[ng-click="onLauncherClick()"]'
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    console.log(`Overview graph selector ${selector} count: ${count}`);

    if (count > 0) {
      try {
        await locator.first().click();
        console.log(`Clicked overview graph launcher via ${selector}`);
        await wait(3000);
        return true;
      } catch (err) {
        console.log(`Could not click overview graph launcher via ${selector}: ${err.message}`);
      }
    }
  }

  console.log('Overview graph launcher not found');
  return false;
}

async function closeLineageOverlayIfOpen(page) {
  const closeSelectors = [
    '[ng-click="close()"]',
    '[aria-label="Close"]',
    '.modal .close',
    '.lineage-graph .close',
    'text=×'
  ];

  for (const selector of closeSelectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    console.log(`Close selector ${selector} count: ${count}`);

    if (count > 0) {
      try {
        await locator.first().click();
        console.log(`Closed lineage overlay via ${selector}`);
        await wait(3000);
        return true;
      } catch (err) {
        console.log(`Could not close overlay via ${selector}: ${err.message}`);
      }
    }
  }

  console.log('No close control found for lineage overlay');
  return false;
}

async function withNewPage(browser, fn) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 }
  });

  try {
    await fn(page);
  } finally {
    await page.close();
  }
}

async function captureOverview(browser, baseUrl) {
  await withNewPage(browser, async (page) => {
    await gotoDocs(page, `${baseUrl}/#!/overview`);
    await screenshot(page, 'assets/dbt-homepage.png');
  });
}

async function captureOverviewGraph(browser, baseUrl) {
  await withNewPage(browser, async (page) => {
    await gotoDocs(page, `${baseUrl}/#!/overview`);
    await openOverviewGraph(page);
    await screenshot(page, 'assets/dbt-lineage-overview.png');
  });
}

async function captureModel(browser, baseUrl, manifest, modelName, outputFile) {
  await withNewPage(browser, async (page) => {
    const uniqueId = getModelUniqueId(manifest, modelName);
    const url = `${baseUrl}/#!/model/${uniqueId}`;

    await gotoDocs(page, url);
    await closeLineageOverlayIfOpen(page);
    await wait(2000);

    await screenshot(page, outputFile);
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false });

  const baseUrl = process.env.DBT_DOCS_URL || 'http://127.0.0.1:8081';
  const manifest = loadManifest();

  try {
    await captureOverview(browser, baseUrl);
    await captureOverviewGraph(browser, baseUrl);

    await captureModel(
      browser,
      baseUrl,
      manifest,
      'stg_leads',
      'assets/stg_leads.png'
    );

    await captureModel(
      browser,
      baseUrl,
      manifest,
      'int_lead_engagement',
      'assets/int_lead_engagement.png'
    );

    await captureModel(
      browser,
      baseUrl,
      manifest,
      'fct_lead_kpis_daily',
      'assets/fct_lead_kpis_daily.png'
    );
  } finally {
    await browser.close();
  }
})();