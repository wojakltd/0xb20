(function (global) {
  const config = global.B20LabConfig;

  async function fetchJson(path, fallbackValue) {
    try {
      const response = await fetch(path, { cache: 'no-cache' });

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
      featured: Boolean(sourceLog.featured)
    };
  }

  function asArray(value, fallbackValue) {
    return Array.isArray(value) ? value : fallbackValue;
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

    async loadProtocol() {
      const result = await fetchJson(config.dataPaths.protocol, config.fallback.protocol);
      const protocol = result.data;
      return protocol && typeof protocol === 'object' ? protocol : null;
    },

    async loadActivity() {
      const result = await fetchJson(config.dataPaths.activity, config.fallback.activity);
      return asArray(result.data, config.fallback.activity);
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

    getLatestLog(logs) {
      const safeLogs = asArray(logs, []);
      return safeLogs[safeLogs.length - 1] || null;
    },

    getFeaturedLog(logs) {
      const safeLogs = asArray(logs, []);
      return safeLogs.find((log) => log.featured) || this.getLatestLog(safeLogs);
    }
  };
})(window);
