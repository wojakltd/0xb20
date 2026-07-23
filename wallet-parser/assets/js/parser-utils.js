(function () {
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  function normalizeAddress(address) {
    return String(address || '').trim();
  }

  function isAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(normalizeAddress(address));
  }

  function addressKey(address) {
    return normalizeAddress(address).toLowerCase();
  }

  function shortAddress(address) {
    const normalized = normalizeAddress(address);

    if (!isAddress(normalized)) {
      return normalized || '--';
    }

    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  }

  function formatTokenAmount(rawValue, decimals, maxFractionDigits = 6) {
    const raw = BigInt(String(rawValue || '0'));
    const safeDecimals = Math.max(0, Number(decimals) || 0);
    const base = 10n ** BigInt(safeDecimals);
    const whole = raw / base;
    const fraction = raw % base;

    if (!fraction || maxFractionDigits <= 0) {
      return whole.toLocaleString('en-US');
    }

    const padded = fraction.toString().padStart(safeDecimals, '0');
    const trimmed = padded.slice(0, maxFractionDigits).replace(/0+$/, '');

    return trimmed ? `${whole.toLocaleString('en-US')}.${trimmed}` : whole.toLocaleString('en-US');
  }

  function formatPercentage(valueRaw, totalSupplyRaw) {
    const value = BigInt(String(valueRaw || '0'));
    const total = BigInt(String(totalSupplyRaw || '0'));

    if (value <= 0n || total <= 0n) {
      return '--';
    }

    const basisPoints = Number((value * 1000000n) / total) / 10000;
    if (!Number.isFinite(basisPoints) || basisPoints <= 0) {
      return '<0.0001%';
    }

    return `${basisPoints.toLocaleString('en-US', {
      maximumFractionDigits: basisPoints >= 1 ? 2 : 4
    })}%`;
  }

  function percentageNumber(valueRaw, totalSupplyRaw) {
    const value = BigInt(String(valueRaw || '0'));
    const total = BigInt(String(totalSupplyRaw || '0'));

    if (value <= 0n || total <= 0n) {
      return 0;
    }

    return Number((value * 1000000n) / total) / 10000;
  }

  function parseDecimalToRaw(value, decimals) {
    const text = String(value || '').trim().replace(/,/g, '');
    const safeDecimals = Math.max(0, Number(decimals) || 0);

    if (!text) {
      return null;
    }

    if (!/^\d+(\.\d+)?$/.test(text)) {
      throw new Error('Invalid numeric filter value.');
    }

    const [whole, fraction = ''] = text.split('.');
    const normalizedFraction = fraction.padEnd(safeDecimals, '0').slice(0, safeDecimals);
    return BigInt(whole || '0') * (10n ** BigInt(safeDecimals)) + BigInt(normalizedFraction || '0');
  }

  function safeText(value, fallback = '--') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms)) {
      return '--';
    }

    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }

    return `${(ms / 1000).toFixed(1)}s`;
  }

  window.B20ParserUtils = {
    zeroAddress,
    normalizeAddress,
    isAddress,
    addressKey,
    shortAddress,
    formatTokenAmount,
    formatPercentage,
    percentageNumber,
    parseDecimalToRaw,
    formatDuration,
    safeText
  };
})();
