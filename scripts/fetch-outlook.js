// ---------------------------------------------------------------------------
// Runs in GitHub Actions on a schedule. Uses a headless browser (Puppeteer)
// to load FXSSI's public "Forex Sentiment Live" page and pull the crowd
// buy/sell percentages it displays — no login, no account, anywhere.
//
// FXSSI has no official API, so this reads their page's own rendered
// output rather than a documented endpoint. Fragile in the normal way
// scraping is: if FXSSI changes the page (or their bot-detection/consent
// flow), this may need updating. It fails loudly with diagnostic output
// rather than silently writing bad data — check the Actions log if it
// fails; the app keeps showing its last good snapshot either way.
//
// COLUMN ORDER ASSUMPTION: unchanged from before — see README. Verify
// against the live page before trusting the Buy/Sell signal.
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

async function fetchRenderedHtml() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    // Spoof the automation flag some sites check for.
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await dismissCookieBanner(page);

    // The sentiment table is filled in async; wait for real data to appear
    // rather than a fixed delay.
    let dataAppeared = true;
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('EURUSD'),
        { timeout: 20000 }
      );
    } catch (e) {
      dataAppeared = false;
    }

    const html = await page.content();
    const bodyTextSnippet = await page.evaluate(() => document.body.innerText.slice(0, 500));

    return { html, dataAppeared, bodyTextSnippet };
  } finally {
    await browser.close();
  }
}

async function main() {
  const { html, dataAppeared, bodyTextSnippet } = await fetchRenderedHtml();
  const text = stripHtml(html);

  const pattern = /\b([A-Z]{6})\b[^%A-Z]{0,15}(\d{1,3})%[^%A-Z]{0,15}(\d{1,3})%/g;

  const symbols = {};
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const [, symbol, buyPct, sellPct] = match;
    const buy = parseFloat(buyPct);
    const sell = parseFloat(sellPct);
    if (Math.abs(buy + sell - 100) > 5) continue;

    symbols[symbol] = {
      longPercent: buy,   // <-- swap with sell below if orientation turns out backwards
      shortPercent: sell
    };
  }

  if (Object.keys(symbols).length === 0) {
    console.error('--- DIAGNOSTIC INFO ---');
    console.error('Did "EURUSD" appear in the rendered page text?', dataAppeared);
    console.error('First 500 chars of rendered page body text:');
    console.error(bodyTextSnippet);
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
