// ---------------------------------------------------------------------------
// Runs in GitHub Actions on a schedule. Fetches FXSSI's public "Forex
// Sentiment Live" page (fxssi.com/tools/current-ratio) — no login, no
// account, genuinely public — and writes a small JSON snapshot that every
// app install reads.
//
// FXSSI has no official API, so this parses their page's own rendered
// output rather than calling a documented endpoint. It's fragile in the
// normal way scraping is: if FXSSI restructures that page, this script
// will start returning 0 symbols (harmless — the app just keeps showing
// its last good data) or need a small regex tweak.
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

async function main() {
  const res = await fetch(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentimentPulseBot/1.0)' }
  });
  if (!res.ok) throw new Error(`FXSSI fetch failed (${res.status})`);
  const html = await res.text();
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
    throw new Error('Parsed 0 symbols from FXSSI page — the page structure likely changed; the regex in this script needs updating.');
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
