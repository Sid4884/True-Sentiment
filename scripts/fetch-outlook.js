// ---------------------------------------------------------------------------
// Runs in GitHub Actions on a schedule. Uses a headless browser (Puppeteer)
// to load FXSSI's public "Forex Sentiment Live" page and pull the crowd
// buy/sell percentages it displays — no login, no account, anywhere.
//
// FXSSI's page lists ONE buy%/sell% row per broker under each symbol
// (MyFxBook, XMGroup, Oanda, FXSSI, Dukascopy, etc), plus one row
// explicitly labeled "Average" — the aggregate across all brokers, which
// is what this script actually extracts. Confirmed layout from a live
// run's rendered text:
//   ...SYMBOL\nBrokerName\nBUY%\nSELL%\nBrokerName2\nBUY%\nSELL%\n...Average\nBUY%\nSELL%\n...
//
// FXSSI has no official API, so this reads their page's own rendered
// output rather than a documented endpoint. Fragile in the normal way
// scraping is: if FXSSI changes the page layout, this may need updating.
// It fails loudly with diagnostic output rather than silently writing bad
// data — check the Actions log if it fails; the app keeps showing its
// last good snapshot either way.
//
// COLUMN ORDER ASSUMPTION: the two percentages after "Average" are assumed
// to be buy% then sell% (mapped to longPercent/shortPercent below), based
// on FXSSI's own description of the tool rather than an explicit label in
// the markup. VERIFY against fxssi.com/tools/current-ratio directly
// (blue bar = Buy%, orange bar = Sell%) before trusting the Buy/Sell
// signal — swap the two lines marked below if it's backwards.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const URL = 'https://fxssi.com/tools/current-ratio';
const OUT_PATH = path.join(__dirname, '..', 'data', 'outlook.json');

async function dismissCookieBanner(page) {
  try {
    const clicked = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a'));
      const target = candidates.find((el) =>
        /accept all|accept cookies|agree/i.test(el.textContent || '')
      );
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (e) {
    // Non-fatal — proceed either way.
  }
}

async function fetchRenderedBodyText() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dismissCookieBanner(page);

    let dataAppeared = true;
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('Average'),
        { timeout: 20000 }
      );
    } catch (e) {
      dataAppeared = false;
    }

    const bodyText = await page.evaluate(() => document.body.innerText);
    return { bodyText, dataAppeared };
  } finally {
    await browser.close();
  }
}

// Find every "Average NN.NN% MM.MM%" occurrence, then attribute it to the
// nearest 6-letter uppercase symbol token appearing earlier in the text.
function parseSymbols(bodyText) {
  const symbolMatches = [...bodyText.matchAll(/\b([A-Z]{6})\b/g)];
  const avgMatches = [...bodyText.matchAll(/Average\s*([\d.]+)%\s*([\d.]+)%/g)];

  const symbols = {};
  for (const avg of avgMatches) {
    let assignedSymbol = null;
    for (const sm of symbolMatches) {
      if (sm.index < avg.index) assignedSymbol = sm[1];
      else break;
    }
    if (!assignedSymbol || assignedSymbol in symbols) continue;

    const buy = parseFloat(avg[1]);
    const sell = parseFloat(avg[2]);
    if (Math.abs(buy + sell - 100) > 5) continue;

    symbols[assignedSymbol] = {
      longPercent: buy,   // <-- swap with sell below if orientation turns out backwards
      shortPercent: sell
    };
  }
  return symbols;
}

async function main() {
  const { bodyText, dataAppeared } = await fetchRenderedBodyText();
  const symbols = parseSymbols(bodyText);

  if (Object.keys(symbols).length === 0) {
    const idx = bodyText.indexOf('EURUSD');
    console.error('--- DIAGNOSTIC INFO ---');
    console.error('Did "Average" appear in the rendered page text?', dataAppeared);
    console.error('Total "Average" occurrences:', (bodyText.match(/Average/g) || []).length);
    if (idx !== -1) {
      console.error('200 characters around the first "EURUSD" match:');
      console.error(JSON.stringify(bodyText.slice(Math.max(0, idx - 100), idx + 100)));
    }
    console.error('-----------------------');
    throw new Error('Parsed 0 symbols from FXSSI page — see diagnostic output above.');
  }

  const output = {
    updatedAt: new Date().toISOString(),
    source: 'fxssi-current-ratio',
    symbols
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${Object.keys(symbols).length} symbols to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
