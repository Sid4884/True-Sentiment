// ---------------------------------------------------------------------------
// App orchestration — reads crowd sentiment from the shared GitHub cache.
// ---------------------------------------------------------------------------

(function () {
  var state = {
    group: 'forex',
    timer: null,
    lastRefreshAt: 0,
    refreshCooldownMs: 5000
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    els.tabs = $('tabs');
    els.cardGrid = $('cardGrid');
    els.updatedAt = $('updatedAt');
    els.refreshBtn = $('refreshBtn');
    els.liveStatus = $('liveStatus');
    els.settingsBtn = $('settingsBtn');
    els.settingsModal = $('settingsModal');
    els.refreshInterval = $('refreshInterval');
    els.modalCancel = $('modalCancel');
    els.modalSave = $('modalSave');
    els.buyThreshold = $('buyThreshold');
    els.sellThreshold = $('sellThreshold');
  }

  function buildCardSkeleton(instrument) {
    var card = document.createElement('article');
    card.className = 'card';
    card.dataset.symbol = instrument.symbol;
    card.innerHTML =
      '<div class="card-head">' +
        '<div>' +
          '<div class="card-symbol">' + instrument.display + '</div>' +
          '<div class="card-name">' + instrument.name + '</div>' +
        '</div>' +
        '<div class="card-pill card-pill--neutral">…</div>' +
      '</div>' +
      '<div class="card-gauge"></div>' +
      '<div class="card-crowd">' +
        '<div class="card-crowd-label">' +
          '<span>Retail long / short</span>' +
          '<span class="card-crowd-pct">—</span>' +
        '</div>' +
        '<div class="card-crowd-bar"><div class="card-crowd-fill"></div></div>' +
      '</div>';
    return card;
  }

  function renderSkeletons(group) {
    els.cardGrid.innerHTML = '';
    INSTRUMENTS[group].forEach(function (instrument) {
      var card = buildCardSkeleton(instrument);
      els.cardGrid.appendChild(card);
      Gauge.render(card.querySelector('.card-gauge'), 0);
    });
  }

  function updateCard(card, outlook) {
    var signal = Sentiment.computeSignal(outlook);
    var tone = Sentiment.toneFor(signal.label);

    var pill = card.querySelector('.card-pill');
    pill.textContent = signal.label;
    pill.className = 'card-pill card-pill--' + tone;

    Gauge.render(card.querySelector('.card-gauge'), signal.score);

    card.querySelector('.card-crowd-pct').textContent =
      Math.round(signal.longPercent) + '% long / ' + Math.round(signal.shortPercent) + '% short';

    var fill = card.querySelector('.card-crowd-fill');
    fill.style.width = signal.longPercent + '%';
    fill.className = 'card-crowd-fill card-crowd-fill--' + tone;
  }

  function setLiveStatus(mode, detail) {
    // mode: 'live' | 'off' | 'error'
    els.liveStatus.className = 'live-status live-status--' +
      (mode === 'live' ? 'on' : mode === 'error' ? 'error' : 'off');
    var labels = { live: 'live', error: detail || 'error', off: 'not configured' };
    els.liveStatus.querySelector('.live-text').textContent = labels[mode] || 'offline';
  }

  function refresh() {
    var sinceLast = Date.now() - state.lastRefreshAt;
    if (sinceLast < state.refreshCooldownMs) {
      var waitSec = Math.ceil((state.refreshCooldownMs - sinceLast) / 1000);
      setLiveStatus('error', 'wait ' + waitSec + 's');
      return;
    }
    state.lastRefreshAt = Date.now();

    var group = state.group;
    els.refreshBtn.classList.add('spinning');

    SharedCache.getCommunityOutlook()
      .then(function (outlookMap) {
        var anyData = false;
        INSTRUMENTS[group].forEach(function (instrument) {
          var card = els.cardGrid.querySelector('[data-symbol="' + instrument.symbol + '"]');
          var outlook = outlookMap[instrument.symbol];
          if (!card || !outlook) return;
          anyData = true;
          updateCard(card, outlook);
        });

        if (anyData) {
          setLiveStatus('live');
          var snapshotAt = SharedCache.getLastUpdatedAt();
          els.updatedAt.textContent = snapshotAt
            ? 'Snapshot from ' + new Date(snapshotAt).toLocaleTimeString()
            : 'Updated ' + new Date().toLocaleTimeString();
        } else {
          setLiveStatus('error', 'no data for this tab');
          els.updatedAt.textContent = 'Shared cache has no data for these symbols yet';
        }
      })
      .catch(function (err) {
        // Keep whatever the cards last showed — don't blank them on a
        // transient failure (network hiccup, cache not configured yet, etc).
        console.error('Shared cache refresh failed:', err);
        setLiveStatus('error', /not configured/i.test(err.message) ? 'set sharedCacheUrl' : 'refresh failed');
        els.updatedAt.textContent = 'Last update failed at ' + new Date().toLocaleTimeString();
      })
      .then(function () {
        els.refreshBtn.classList.remove('spinning');
      });
  }

  function switchGroup(group) {
    state.group = group;
    Array.prototype.forEach.call(els.tabs.querySelectorAll('.tab'), function (tab) {
      tab.classList.toggle('tab--active', tab.dataset.group === group);
    });
    renderSkeletons(group);
    refresh();
  }

  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    var seconds = parseInt(localStorage.getItem(APP_CONFIG.storageKeys.refreshInterval), 10) ||
      APP_CONFIG.defaultRefreshSeconds;
    if (seconds > 0) {
      state.timer = setInterval(refresh, seconds * 1000);
    }
  }

  function openSettings() {
    els.refreshInterval.value = localStorage.getItem(APP_CONFIG.storageKeys.refreshInterval) ||
      String(APP_CONFIG.defaultRefreshSeconds);
    var t = Sentiment.getThresholds();
    els.buyThreshold.value = t.buy;
    els.sellThreshold.value = t.sell;
    els.settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    els.settingsModal.classList.add('hidden');
  }

  function saveSettings() {
    localStorage.setItem(APP_CONFIG.storageKeys.refreshInterval, els.refreshInterval.value);
    localStorage.setItem(APP_CONFIG.storageKeys.buyThreshold, els.buyThreshold.value);
    localStorage.setItem(APP_CONFIG.storageKeys.sellThreshold, els.sellThreshold.value);
    closeSettings();
    startTimer();
    state.lastRefreshAt = 0; // allow an immediate refresh right after saving
    refresh();
  }

  function bindEvents() {
    Array.prototype.forEach.call(els.tabs.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () { switchGroup(tab.dataset.group); });
    });
    els.refreshBtn.addEventListener('click', refresh);
    els.settingsBtn.addEventListener('click', openSettings);
    els.modalCancel.addEventListener('click', closeSettings);
    els.modalSave.addEventListener('click', saveSettings);
    els.settingsModal.addEventListener('click', function (e) {
      if (e.target === els.settingsModal) closeSettings();
    });
  }

  function init() {
    cacheEls();
    bindEvents();
    renderSkeletons(state.group);
    refresh();
    startTimer();
  }

  document.addEventListener('deviceready', init, false);
  // Also init on plain page load so it works when previewed in a browser
  // (deviceready never fires outside a real Cordova WebView).
  if (!window.cordova) {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
