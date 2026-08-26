// ---------------------------------------------------------------------------
// Reads the shared community-outlook snapshot published by the GitHub
// Actions workflow (.github/workflows/fetch-outlook.yml + scripts/fetch-
// outlook.js). No login, no credentials, no per-user Myfxbook session —
// every install of this app just reads the same small public JSON file.
// ---------------------------------------------------------------------------

var SharedCache = (function () {

  // Snapshot itself only changes every ~30 min (the workflow's schedule),
  // so there's no reason to re-download more often than this even if the
  // user sets a shorter in-app refresh interval.
  var MIN_FETCH_INTERVAL_MS = 60 * 1000;

  var memory = {
    data: null,
    fetchedAt: 0
  };

  function isFresh() {
    return memory.data && (Date.now() - memory.fetchedAt) < MIN_FETCH_INTERVAL_MS;
  }

  function getCommunityOutlook() {
    if (isFresh()) return Promise.resolve(memory.data);

    if (!APP_CONFIG.sharedCacheUrl || APP_CONFIG.sharedCacheUrl.indexOf('YOUR_GITHUB_USER') !== -1) {
      return Promise.reject(new Error('sharedCacheUrl is not configured in config.js'));
    }

    // Cache-bust: raw.githubusercontent.com sits behind a CDN with a short
    // TTL, but a query param guarantees we're not reading a stale local
    // WebView/network cache either.
    var url = APP_CONFIG.sharedCacheUrl + (APP_CONFIG.sharedCacheUrl.indexOf('?') === -1 ? '?' : '&') + 'ts=' + Date.now();

    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Shared cache fetch failed (' + res.status + ')');
        return res.json();
      })
      .then(function (json) {
        if (!json.symbols) throw new Error('Shared cache JSON missing "symbols"');
        memory.data = json.symbols;
        memory.fetchedAt = Date.now();
        memory.updatedAt = json.updatedAt;
        return memory.data;
      });
  }

  function getLastUpdatedAt() {
    return memory.updatedAt || null;
  }

  return {
    getCommunityOutlook: getCommunityOutlook,
    getLastUpdatedAt: getLastUpdatedAt
  };
})();
