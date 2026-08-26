// ---------------------------------------------------------------------------
// Runs in GitHub Actions on a schedule. Uses a headless browser (Puppeteer)
// to load FXSSI's public "Forex Sentiment Live" page — the sentiment table
// is filled in by JavaScript after the page loads, so a plain HTTP fetch
// sees an empty shell. This waits for the real content, then parses it,
// and writes a small JSON snapshot that every app install reads.
//
// No login, no account, anywhere in this script.
//
// FXSSI has no official API, so this reads their page's own rendered
// output rather than a documented endpoint. It's fragile in the normal
// way scraping is: if FXSSI restructures that page, this script may start
// returning 0 symbols (harmless — the app just keeps showing its last
// good data) or need a small selector/regex tweak.
//
// COLUMN ORDER ASSUMPTION: the page lists two percentages per symbol that
// sum to ~100 (buy% and sell%), inferred from FXSSI's own description of
// the tool ("above 60% buyers = sell signal, below 40% buyers = buy
// signal") rather than an explicit per-column label in the markup. This
// script assumes: 1st number = buy% (mapped to longPercent), 2nd number =
// sell% (mapped to shortPercent). VERIFY this against fxssi.com/tools/
// current-ratio directly (blue bar = Buy%, orange bar = Sell%) before
// trusting the signal — swap the two lines marked below if it's backwards.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const URL = 'https://fxssi.com/tools/current-ratio';
const OUT_PATH = path.join(__dirname, '..', 'data', 'outlook.json');

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

async function fetchRenderedHtml() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; SentimentPulseBot/1.0)');
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // The sentiment table is filled in async; give it a moment to appear.
    // We don't know the exact selector, so wait for text that only shows
    // up once real data has loaded (a known pair symbol).
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('EURUSD'),
        { timeout: 15000 }
      );
    } catch (e) {
      // Fall through anyway — main() will fail loudly if parsing finds nothing.
    }

    return await page.content();
  } finally {
    await browser.close();
  }
}

async function main() {
  const html = await fetchRenderedHtml();
  const text = stripHtml(html);

  // Looks for: SYMBOL (6 uppercase letters) ... NN% ... MM%  within a short span,
  // matching the "Quick Sentiment" table's SYMBOL / buy% / sell% layout.
  const pattern = /\b([A-Z]{6})\b[^%A-Z]{0,15}(\d{1,3})%[^%A-Z]{0,15}(\d{1,3})%/g;

  const symbols = {};
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const [, symbol, buyPct, sellPct] = match;
    const buy = parseFloat(buyPct);
    const sell = parseFloat(sellPct);
    // Sanity check: the two numbers should roughly sum to 100. If they
    // don't, this probably isn't a real sentiment row (a false-positive
    // match elsewhere on the page) — skip it.
    if (Math.abs(buy + sell - 100) > 5) continue;

    symbols[symbol] = {
      longPercent: buy,   // <-- swap with sell below if orientation turns out backwards
      shortPercent: sell
    };
  }

  if (Object.keys(symbols).length === 0) {
    throw new Error('Parsed 0 symbols from FXSSI page — the page structure likely changed; the regex/selector in this script needs updating.');
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
