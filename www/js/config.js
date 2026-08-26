// ---------------------------------------------------------------------------
// SentimentPulse configuration: instrument universe + storage keys
// ---------------------------------------------------------------------------

var APP_CONFIG = {
  storageKeys: {
    refreshInterval: 'sp_refresh_interval',
    buyThreshold: 'sp_buy_threshold',
    sellThreshold: 'sp_sell_threshold'
  },
  // Point this at the raw JSON file your GitHub Actions workflow publishes.
  // Format: https://raw.githubusercontent.com/<user>/<repo>/<branch>/data/outlook.json
  sharedCacheUrl: 'https://raw.githubusercontent.com/YOUR_GITHUB_USER/YOUR_REPO/main/data/outlook.json',
  defaultRefreshSeconds: 60,
  // Contrarian signal thresholds: if the crowd is this % (or more) short,
  // that's read as a BUY signal (fade them); this % (or more) long -> SELL.
  defaultBuyThreshold: 70,   // crowd short% >= this -> Buy
  defaultSellThreshold: 70   // crowd long% >= this -> Sell
};

// Myfxbook's community outlook only covers forex majors/crosses and metals —
// no indices, no energy/soft commodities. `symbol` is Myfxbook's own ticker
// format (no slash); `name` and `display` are just for the UI.
var INSTRUMENTS = {
  forex: [
    { symbol: 'EURUSD', display: 'EUR/USD', name: 'Euro / US Dollar' },
    { symbol: 'GBPUSD', display: 'GBP/USD', name: 'British Pound / US Dollar' },
    { symbol: 'USDJPY', display: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
    { symbol: 'USDCHF', display: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
    { symbol: 'AUDUSD', display: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
    { symbol: 'USDCAD', display: 'USD/CAD', name: 'US Dollar / Canadian Dollar' },
    { symbol: 'NZDUSD', display: 'NZD/USD', name: 'New Zealand Dollar / US Dollar' },
    { symbol: 'EURGBP', display: 'EUR/GBP', name: 'Euro / British Pound' },
    { symbol: 'EURJPY', display: 'EUR/JPY', name: 'Euro / Japanese Yen' },
    { symbol: 'GBPJPY', display: 'GBP/JPY', name: 'British Pound / Japanese Yen' }
  ],
  metals: [
    { symbol: 'XAUUSD', display: 'XAU/USD', name: 'Gold' },
    { symbol: 'XAGUSD', display: 'XAG/USD', name: 'Silver' }
  ]
};
