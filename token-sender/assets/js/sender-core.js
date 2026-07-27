(function (global) {
  const delay = (ms) => new Promise((resolve) => global.setTimeout(resolve, ms));

  function nowIso() {
    return new Date().toISOString();
  }

  function safeFilename(value, fallback) {
    const text = String(value || '')
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '');

    return text || fallback || 'B20';
  }

  function shortAddress(address) {
    const value = String(address || '');
    return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value || '--';
  }

  function errorMessage(error, fallback) {
    if (error && Number(error.code) === 4001) {
      return 'Wallet request rejected.';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback || 'Laboratory operation failed.';
  }

  function formatDuration(ms) {
    const value = Math.max(0, Number(ms || 0));
    const seconds = Math.floor(value / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  function download(filename, mimeType, content) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function chunk(items, size) {
    const output = [];
    const safeSize = Math.max(1, Number(size || 1));

    for (let index = 0; index < items.length; index += safeSize) {
      output.push(items.slice(index, index + safeSize));
    }

    return output;
  }

  function uniqByAddress(recipients) {
    const seen = new Set();
    const unique = [];
    let duplicates = 0;

    (recipients || []).forEach((recipient) => {
      const key = String(recipient.address || '').toLowerCase();

      if (!key || seen.has(key)) {
        duplicates += 1;
        return;
      }

      seen.add(key);
      unique.push(recipient);
    });

    return { unique, duplicates };
  }

  global.B20SenderCore = {
    delay,
    nowIso,
    safeFilename,
    shortAddress,
    errorMessage,
    formatDuration,
    download,
    chunk,
    uniqByAddress
  };
})(window);
