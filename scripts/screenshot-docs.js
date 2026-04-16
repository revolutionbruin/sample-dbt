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
  const explicit = process.env.DBT_MANIFEST_PATH;
  const candidates = [
    explicit,
    path.join(process.cwd(), 'site', 'manifest.json'),
    path.join(process.cwd(), 'target', 'manifest.json'),
    path.join(process.cwd(), 'leads_metrics', 'target', 'manifest.json')
  ];

  const manifestPath = findFirstExistingPath(candidates);

  if (!manifestPath) {
    throw new Error(
      `Could not find manifest.json. Checked:\n${candidates.filter(Boolean).join('\n')}`
    );
  }

  console.log(`Using manifest at: ${manifestPath}`);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function getModelUniqueId(manifest, modelName) {
  const nodes = manifest.nodes || {};

  for (const node of Object.values(nodes)) {
    if (node.resource_type === 'model' && node.name === modelName) {
      return node.unique_id;
    }
  }

  throw new Error(`Could not find model "${modelName}" in manifest.json`);
}

async function clickIfVisible(locator, label = 'locator') {
  const count = await locator.count();
  if (!count) {
    console.log(`No matches for ${label}`);
    return false;
  }

  const first = locator.first();

  try {
    await first.waitFor({ state: 'visible', timeout: 3000 });
    await first.click();
    console.log(`Clicked ${label}`);
    return true;
  } catch (err) {
    console.log(`Could not click ${label}: ${err.message}`);
    return false;
  }
}

async function tryOpenGraph(page) {
  const strategies = [
    {
      label: 'data-original-title',
      locator: page.locator('[data-original-title="View Lineage Graph"]')
    },
    {
      label: 'title',
      locator: page.locator('[title="View Lineage Graph"]')
    },
    {
      label: 'ng-click',
      locator: page.locator('[ng-click="onLauncherClick()"]')
    },
    {
      label: 'tooltip contains lineage',
      locator: page.locator('[data-original-title*="Lineage"]')
    },
    {
      label: 'graph icon use href',
      locator: page.locator('a:has(svg use[xlink\\:href="#icn-flow"])')
    }
  ];

  for (const strategy of strategies) {
    const clicked = await clickIfVisible(strategy.locator, strategy.label);
    if (clicked) {
      await wait(2500);
      return true;
    }
  }

  console.log('Graph launcher not found');
  return false;
}

async function gotoDocsRoute(page, baseUrl, hashRoute) {
  const url = `${baseUrl}/${hashRoute}`;
  console.log(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await wait(2500);
}

async function screenshotFullPage(page, outputPath) {
  await wait(1000);
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`Saved screenshot: ${outputPath}`);
}

async function captureHome(page, baseUrl) {
  await gotoDocsRoute(page, baseUrl, '#!/overview');
  await screenshotFullPage(page, 'assets/dbt-docs-home.png');
}

async function captureOverviewGraph(page, baseUrl) {
  await gotoDocsRoute(page, baseUrl, '#!/overview');
  const opened = await tryOpenGraph(page);

  if (!opened) {
    console.log('Falling back to overview screenshot because lineage graph launcher was not found.');
  }

  await screenshotFullPage(page, 'assets/dbt-docs-graph.png');
}

async function captureModelPage(page, baseUrl, manifest, modelName, outputPath, graphOutputPath = null) {
  const uniqueId = getModelUniqueId(manifest, modelName);

  await gotoDocsRoute(page, baseUrl, `#!/model/${uniqueId}`);
  await screenshotFullPage(page, outputPath);

  if (graphOutputPath) {
    const opened = await tryOpenGraph(page);

    if (!opened) {
      console.log(`Lineage graph launcher not found on ${modelName}; using model page as fallback.`);
    }

    await screenshotFullPage(page, graphOutputPath);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 }
  });

  const baseUrl = process.env.DBT_DOCS_URL || 'http://127.0.0.1:8081';
  const manifest = loadManifest();

  try {
    await captureHome(page, baseUrl);
    await captureOverviewGraph(page, baseUrl);

    await captureModelPage(
      page,
      baseUrl,
      manifest,
      'int_lead_engagement',
      'assets/dbt-int-lead-engagement.png',
      'assets/dbt-int-lead-engagement-graph.png'
    );

    await captureModelPage(
      page,
      baseUrl,
      manifest,
      'fct_lead_kpis_daily',
      'assets/dbt-fct-lead-kpis-daily.png',
      'assets/dbt-fct-lead-kpis-daily-graph.png'
    );
  } finally {
    await browser.close();
  }
})();