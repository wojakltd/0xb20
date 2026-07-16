(function (global) {
  const config = global.B20LabConfig;

  function withCacheBust(path) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${Date.now()}`;
  }

  async function fetchJson(path, fallbackValue) {
    try {
      const response = await fetch(withCacheBust(path), { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return {
        ok: true,
        data: await response.json()
      };
    } catch (error) {
      return {
        ok: false,
        data: fallbackValue
      };
    }
  }

  function normalizeLog(log, index) {
    const sourceLog = log && typeof log === 'object' ? log : {};
    const id = Number(sourceLog.id) || index + 1;
    const logNumber = sourceLog.logNumber ? String(sourceLog.logNumber).padStart(3, '0') : '';
    const content = String(sourceLog.content || sourceLog.text || sourceLog.summary || 'Laboratory Archive unavailable.');
    const summary = String(sourceLog.summary || content.split('\n')[0] || content);

    return {
      id,
      logNumber,
      entryLabel: String(sourceLog.entryLabel || (logNumber ? `LOG #${logNumber}` : 'NOTE')),
      title: String(sourceLog.title || 'Untitled Laboratory Log'),
      date: String(sourceLog.date || ''),
      type: String(sourceLog.type || 'research').toLowerCase(),
      summary,
      content,
      tags: Array.isArray(sourceLog.tags) ? sourceLog.tags.map((tag) => String(tag).toLowerCase()) : [],
      featured: Boolean(sourceLog.featured),
      link: String(sourceLog.link || ''),
      linkLabel: String(sourceLog.linkLabel || '')
    };
  }

  function asArray(value, fallbackValue) {
    return Array.isArray(value) ? value : fallbackValue;
  }

  function normalizeResearchPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    return {
      metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : null,
      posts: asArray(source.posts, [])
    };
  }

  function formatClock(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '--:--';
    }

    return new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  function createResearchActivityEntry(post) {
    const text = String(post.text || 'Observation archived.').replace(/\s+/g, ' ').trim();
    const title = text.length > 76 ? `${text.slice(0, 73)}...` : text;

    return {
      time: formatClock(post.created_at || post.createdAt),
      title: post.category === 'laboratory' ? `Laboratory: ${title}` : `Observation: ${title}`
    };
  }

  function markUnavailable(logs) {
    Object.defineProperty(logs, 'unavailable', {
      value: true,
      enumerable: false
    });
    return logs;
  }

  global.B20Data = {
    async loadLogs() {
      const result = await fetchJson(config.dataPaths.logs, config.fallback.logs);
      const source = asArray(result.data, config.fallback.logs);
      const logs = source.map(normalizeLog);

      if (result.ok || global.location.protocol === 'file:') {
        return logs;
      }

      return markUnavailable([]);
    },

    async loadEvolution() {
      const result = await fetchJson(config.dataPaths.evolution, config.fallback.evolution);
      const evolution = result.data;
      return evolution && typeof evolution === 'object' ? evolution : null;
    },

    async loadTerminalEvents() {
      const result = await fetchJson(config.dataPaths.terminalEvents, config.fallback.terminalEvents);
      return asArray(result.data, config.fallback.terminalEvents);
    },

    async loadScannerConfig() {
      const result = await fetchJson(config.dataPaths.scanner, config.fallback.scanner);
      const scanner = result.data;
      return scanner && typeof scanner === 'object' ? scanner : config.fallback.scanner;
    },

    async loadStatus() {
      const result = await fetchJson(config.dataPaths.status, config.fallback.status);
      const status = result.data;
      return status && typeof status === 'object' ? status : config.fallback.status;
    },

    async loadResearchFeed() {
      const result = await fetchJson(config.dataPaths.researchFeed, config.fallback.researchFeed);
      return normalizeResearchPayload(result.data);
    },

    getLatestLog(logs) {
      const safeLogs = asArray(logs, []);
      return safeLogs[safeLogs.length - 1] || null;
    },

    getFeaturedLog(logs) {
      const safeLogs = asArray(logs, []);
      return safeLogs.find((log) => log.featured) || this.getLatestLog(safeLogs);
    },

    getResearchActivity(researchFeed) {
      const payload = normalizeResearchPayload(researchFeed);
      const metadata = payload.metadata || {};
      const posts = payload.posts.slice(0, 4).map(createResearchActivityEntry);
      const syncEntry = metadata.generatedAt
        ? { time: formatClock(metadata.generatedAt), title: 'Research Terminal synchronized' }
        : null;
      const countEntry = metadata.posts
        ? { time: 'BASE', title: `${metadata.posts} observations indexed` }
        : null;

      return [syncEntry, ...posts, countEntry].filter(Boolean);
    }
  };
})(window);
