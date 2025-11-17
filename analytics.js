(function () {
  const COUNT_API_BASE = 'https://api.countapi.xyz';
  const NAMESPACE = 'masstesting_github_io';
  const COUNTERS = {
    visits: 'total-visits',
    unique: 'unique-users',
    time: 'total-seconds',
    linkTotal: 'link-total'
  };
  const LINK_PREFIX = 'link-';
  const KNOWN_LINK_KEYS = new Set([
    'case-samokat',
    'case-ozon',
    'resume-download',
    'tg-link',
    'linkedin-link',
    'email-link'
  ]);
  const LOCAL_STORAGE_NS = 'mtgio.analytics';
  const STORAGE_KEYS = {
    userId: `${LOCAL_STORAGE_NS}.userId`,
    uniqueMarked: `${LOCAL_STORAGE_NS}.uniqueMarked`
  };

  const sessionStartTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const absoluteStartTime = Date.now();
  let timeReported = false;

  init();

  function init() {
    recordVisit();
    ensureUniqueMarked();
    attachLinkTracking();
    setupDelegatedLinkTracking();
    setupSessionTiming();
    scheduleConsoleSummary();
  }

  function scheduleConsoleSummary() {
    if (typeof console === 'undefined') {
      return;
    }
    setTimeout(() => {
      fetchSummary().then((summary) => {
        if (!summary) {
          return;
        }
        const formatted = {
          'Всего посещений': summary.visits ?? '—',
          'Уникальных пользователей': summary.unique ?? '—',
          'Суммарное время (сек)': summary.time ?? '—',
          'Кликов по ссылкам': summary.linkTotal ?? '—'
        };
        console.info('%cАналитика сайта', 'font-weight:bold; color:#CC0E1F;');
        console.table(formatted);
        if (summary.linkBreakdown && Object.keys(summary.linkBreakdown).length) {
          console.info('Клики по ссылкам:', summary.linkBreakdown);
        }
      }).catch(() => {
        /* ignore */
      });
    }, 2200);
  }

  function recordVisit() {
    hitCounter(COUNTERS.visits);
  }

  function ensureUniqueMarked() {
    try {
      const userId = getOrCreateUserId();
      if (!userId) {
        return;
      }
      if (localStorage.getItem(STORAGE_KEYS.uniqueMarked) === 'true') {
        return;
      }
      localStorage.setItem(STORAGE_KEYS.uniqueMarked, 'true');
      hitCounter(COUNTERS.unique);
    } catch (error) {
      // localStorage might be unavailable; fallback: still attempt to count once per session
      hitCounter(COUNTERS.unique);
    }
  }

  function attachLinkTracking() {
    const links = document.querySelectorAll('[data-analytics-key]');
    links.forEach((link) => {
      if (!link || !link.dataset) {
        return;
      }
      const key = sanitizeKey(link.dataset.analyticsKey);
      if (!key) {
        return;
      }
      if (link.hasAttribute('data-analytics-delegate')) {
        KNOWN_LINK_KEYS.add(key);
        return;
      }
      KNOWN_LINK_KEYS.add(key);
      link.addEventListener('click', (event) => {
        if (event && event.type === 'click' && event.button !== 0) {
          return;
        }
        recordLinkClick(key);
      });
      link.addEventListener('auxclick', (event) => {
        if (event.button === 1) {
          recordLinkClick(key);
        }
      });
    });
  }

  function setupDelegatedLinkTracking() {
    window.addEventListener('analytics:link-click', (event) => {
      const detail = event.detail || {};
      const key = sanitizeKey(detail.key);
      if (!key) {
        return;
      }
      KNOWN_LINK_KEYS.add(key);
      recordLinkClick(key);
    });
  }

  function recordLinkClick(key) {
    updateCounter(`${LINK_PREFIX}${key}`, 1);
    updateCounter(COUNTERS.linkTotal, 1);
  }

  function setupSessionTiming() {
    const handler = () => {
      reportSessionTime();
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handler();
      }
    });
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
  }

  function reportSessionTime() {
    if (timeReported) {
      return;
    }
    timeReported = true;
    const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const elapsedMs = endTime - sessionStartTime;
    const fallbackElapsed = Date.now() - absoluteStartTime;
    const durationSeconds = Math.max(1, Math.round((Number.isFinite(elapsedMs) ? elapsedMs : fallbackElapsed) / 1000));
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      updateCounter(COUNTERS.time, durationSeconds);
    }
  }

  function hitCounter(key) {
    apiRequest(`/hit/${encodeURIComponent(NAMESPACE)}/${encodeURIComponent(key)}`).catch(() => {
      /* ignore */
    });
  }

  function updateCounter(key, amount) {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    apiRequest(`/update/${encodeURIComponent(NAMESPACE)}/${encodeURIComponent(key)}?amount=${encodeURIComponent(safeAmount)}`).catch(() => {
      /* ignore */
    });
  }

  function getCounter(key) {
    return apiRequest(`/get/${encodeURIComponent(NAMESPACE)}/${encodeURIComponent(key)}`);
  }

  function apiRequest(path) {
    return fetch(`${COUNT_API_BASE}${path}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit'
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }
      return response.json();
    }).catch((error) => {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[analytics]', error.message || error);
      }
      throw error;
    });
  }

  function getOrCreateUserId() {
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.userId);
      if (existing) {
        return existing;
      }
      const id = generateId();
      localStorage.setItem(STORAGE_KEYS.userId, id);
      return id;
    } catch (error) {
      return null;
    }
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(4);
      crypto.getRandomValues(array);
      return Array.from(array, (num) => num.toString(16)).join('');
    }
    return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function sanitizeKey(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    return value.trim().toLowerCase().replace(/[^a-z0-9\-]+/g, '-');
  }

  async function fetchSummary() {
    try {
      const [visits, unique, time, linkTotal] = await Promise.all([
        getCounter(COUNTERS.visits).catch(() => null),
        getCounter(COUNTERS.unique).catch(() => null),
        getCounter(COUNTERS.time).catch(() => null),
        getCounter(COUNTERS.linkTotal).catch(() => null)
      ]);
      const summary = {
        visits: visits ? visits.value : null,
        unique: unique ? unique.value : null,
        time: time ? time.value : null,
        linkTotal: linkTotal ? linkTotal.value : null,
        linkBreakdown: {}
      };
      await Promise.all(Array.from(KNOWN_LINK_KEYS).map(async (key) => {
        if (!key) {
          return;
        }
        const counterKey = `${LINK_PREFIX}${key}`;
        const result = await getCounter(counterKey).catch(() => null);
        if (result && typeof result.value === 'number') {
          summary.linkBreakdown[key] = result.value;
        }
      }));
      return summary;
    } catch (error) {
      return null;
    }
  }

  window.showAnalyticsSummary = fetchSummary;
})();
