// ---------------------------------------------------------------------------
// Contrarian retail-sentiment signal, derived purely from Myfxbook's crowd
// long/short positioning — no price feed involved.
//
// Logic: retail crowds are (on average, historically) more often wrong at
// extremes, so a heavily one-sided crowd is read as a contrarian signal:
//   crowd short% >= buyThreshold  -> BUY  (fade the crowd's shorts)
//   crowd long%  >= sellThreshold -> SELL (fade the crowd's longs)
//   otherwise                      -> NEUTRAL
// Thresholds default to 70% and are configurable in Settings.
// ---------------------------------------------------------------------------

var Sentiment = (function () {

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getThresholds() {
    var buy = parseInt(localStorage.getItem(APP_CONFIG.storageKeys.buyThreshold), 10);
    var sell = parseInt(localStorage.getItem(APP_CONFIG.storageKeys.sellThreshold), 10);
    return {
      buy: isNaN(buy) ? APP_CONFIG.defaultBuyThreshold : buy,
      sell: isNaN(sell) ? APP_CONFIG.defaultSellThreshold : sell
    };
  }

  // outlook: { longPercent, shortPercent }
  function computeSignal(outlook) {
    var longPct = clamp(outlook.longPercent, 0, 100);
    var shortPct = clamp(outlook.shortPercent, 0, 100);
    var t = getThresholds();

    var label = 'Neutral';
    if (shortPct >= t.buy) label = 'Buy';
    else if (longPct >= t.sell) label = 'Sell';

    // A -100..100 score purely for the gauge needle: positive (bullish side)
    // when the crowd is short-heavy (contrarian Buy), negative when the
    // crowd is long-heavy (contrarian Sell). Not used for the label itself —
    // the label follows the explicit threshold rule above.
    var score = Math.round(shortPct - longPct);

    return {
      label: label,
      score: score,
      longPercent: longPct,
      shortPercent: shortPct,
      thresholds: t
    };
  }

  function toneFor(label) {
    if (label === 'Buy') return 'bullish';
    if (label === 'Sell') return 'bearish';
    return 'neutral';
  }

  return {
    computeSignal: computeSignal,
    toneFor: toneFor,
    getThresholds: getThresholds
  };
})();
