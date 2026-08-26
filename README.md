# SentimentPulse — Cordova app

A contrarian retail-sentiment app for forex majors/crosses and metals (gold,
silver), built as an Apache Cordova project targeting Android.

## How it works

Sentiment comes from Myfxbook's community outlook (real retail long/short
positioning) — but **no user, including you, needs to log into Myfxbook
inside the app.** Instead:

1. A **GitHub Actions workflow** (`.github/workflows/fetch-outlook.yml`)
   runs on a schedule (every 30 min by default), logs into Myfxbook using
   *your* credentials — stored as encrypted GitHub repo secrets, never
   shipped in the app — and writes the result to `data/outlook.json` in
   the repo.
2. The **app** fetches that public JSON file directly from
   `raw.githubusercontent.com` — a plain static file read, no login, no
   API key, no server to run or pay for.

Every install of the app reads the same file, so it doesn't matter whether
1 person or 100,000 people are using it — your Myfxbook account is only
ever contacted once every 30 minutes, by GitHub's servers, regardless of
your user count.

The Buy/Sell logic itself is unchanged — a contrarian read of the crowd:
- crowd **short%** ≥ your Buy threshold (default 70%) → **Buy** (fade the shorts)
- crowd **long%** ≥ your Sell threshold (default 70%) → **Sell** (fade the longs)
- otherwise → **Neutral**

This is a well-known contrarian retail-sentiment heuristic, not a
guaranteed edge — treat it as one input, not a trading system.

## One-time setup

1. **Create a GitHub repo** and push this project to it (public repo — the
   snapshot file needs to be publicly readable by the app; nothing
   sensitive is ever committed).
2. **Add two repo secrets** (Settings → Secrets and variables → Actions):
   - `MYFXBOOK_EMAIL`
   - `MYFXBOOK_PASSWORD`
3. **Enable the workflow** — it runs automatically on the schedule once
   it's on the default branch. You can also trigger it manually from the
   Actions tab (`workflow_dispatch`) to generate the first snapshot
   immediately rather than waiting up to 30 minutes.
4. **Point the app at your repo** — edit `www/js/config.js`:
   ```js
   sharedCacheUrl: 'https://raw.githubusercontent.com/YOUR_GITHUB_USER/YOUR_REPO/main/data/outlook.json'
   ```
   Replace `YOUR_GITHUB_USER`/`YOUR_REPO` with your actual values, then
   rebuild the app.

That's it — no server to host, no login screen in the app at all.

## Coverage

Myfxbook's community outlook only covers forex majors/crosses and metals —
no indices, no energy or soft commodities. The app has two tabs: **Forex**
(10 pairs) and **Metals** (gold, silver). Edit `www/js/config.js` to
add/remove symbols; use Myfxbook's own ticker format (no slash, e.g.
`EURUSD`, `XAUUSD`) — the workflow pulls every symbol Myfxbook returns, so
adding a new one to the app doesn't require changing the workflow.

## Project structure

```
sentiment-app/
├── .github/workflows/fetch-outlook.yml   Scheduled job: logs in, writes data/outlook.json
├── scripts/fetch-outlook.js               The login + fetch + write logic the workflow runs
├── data/outlook.json                      The published snapshot (auto-updated by the workflow)
├── config.xml                             Cordova app config
├── package.json
├── www/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── config.js         Instrument list, thresholds, sharedCacheUrl
│   │   ├── sentiment.js       Contrarian Buy/Sell/Neutral logic
│   │   ├── gauge.js            SVG dial gauge renderer
│   │   ├── sharedCache.js       Fetches data/outlook.json from GitHub
│   │   └── app.js                App wiring: tabs, refresh loop, settings
│   └── img/icon.png                Placeholder app icon — replace with your own
```

## Build it

You'll need Node.js and the Android SDK / Android Studio installed locally.

```bash
npm install -g cordova
cd sentiment-app
cordova platform add android
cordova plugin add cordova-plugin-whitelist cordova-plugin-statusbar cordova-plugin-network-information
cordova build android
```

Run on a connected device or emulator:

```bash
cordova run android
```

The debug APK will be at
`platforms/android/app/build/outputs/apk/debug/app-debug.apk`.

## Notes

- **Snapshot freshness**: the workflow runs every 30 minutes; the app's own
  refresh button/timer just re-reads whatever the latest snapshot is — it
  can't get anything fresher than the workflow's last run. Tighten the
  cron in `fetch-outlook.yml` if you want it more current (GitHub's cron
  has no hard minimum, but sub-15-minute schedules get unreliable in
  practice under GitHub's own scheduling load).
- **CDN caching**: `raw.githubusercontent.com` sits behind a CDN with a
  short TTL. `sharedCache.js` appends a cache-busting timestamp query
  param to work around stale local/network caches, but a very recent
  commit may take a minute or two to propagate.
- **Rate limits**: `raw.githubusercontent.com` is rate-limited per IP for
  unauthenticated requests (roughly 60/hour). Fine for an app polling
  every 60+ seconds; if you expect heavy concurrent usage from users who
  might share a NAT/IP (corporate networks, etc.), consider serving the
  file from GitHub Pages instead, which doesn't share that limit.
- Credentials never appear in the app, in `localStorage`, or in git
  history — only as encrypted GitHub Actions secrets.
- `www/img/icon.png` is a generated placeholder — swap it and regenerate
  density variants (or use `cordova-res`) before publishing.
