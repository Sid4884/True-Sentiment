// ---------------------------------------------------------------------------
// Runs in GitHub Actions on a schedule. Logs into Myfxbook with credentials
// from repo secrets (never exposed to the app or any device), pulls the
// community outlook, and writes a small public JSON file that every app
// install reads — no per-user login required.
//
// Required env vars (set as GitHub repo secrets):
//   MYFXBOOK_EMAIL
//   MYFXBOOK_PASSWORD
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const BASE = 'https://www.myfxbook.com/api';
const OUT_PATH = path.join(__dirname, '..', 'data', 'outlook.json');

async function login(email, password) {
  const url = `${BASE}/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Myfxbook login failed: ${data.message}`);
  return data.session;
}

async function getCommunityOutlook(session) {
  const url = `${BASE}/get-community-outlook.json?session=${encodeURIComponent(session)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Myfxbook outlook request failed: ${data.message}`);
  return data;
}

async function main() {
  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;
  if (!email || !password) {
    throw new Error('MYFXBOOK_EMAIL / MYFXBOOK_PASSWORD env vars are required');
  }

  const session = await login(email, password);
  const raw = await getCommunityOutlook(session);

  const list = (raw.symbols && raw.symbols.symbol) || [];
  const symbols = {};
  (Array.isArray(list) ? list : [list]).forEach((item) => {
    if (item && item.name) {
      symbols[item.name] = {
        longPercent: parseFloat(item.longPercentage ?? item.longPercent ?? 0),
        shortPercent: parseFloat(item.shortPercentage ?? item.shortPercent ?? 0)
      };
    }
  });

  const output = {
    updatedAt: new Date().toISOString(),
    source: 'myfxbook-community-outlook',
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
