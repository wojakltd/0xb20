(function (global) {
  const selectors = {
    purchase: '0x64edfbf0',
    isLicenseActive: '0xbaa83a09',
    licenseExpiration: '0xfed628db'
  };

  function isAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
  }

  function normalizeAddress(value) {
    const address = String(value || '').trim();
    if (!isAddress(address)) {
      throw new Error('Invalid address.');
    }
    return address;
  }

  function padAddress(address) {
    return normalizeAddress(address).slice(2).toLowerCase().padStart(64, '0');
  }

  function padUint256(value) {
    return BigInt(value).toString(16).padStart(64, '0');
  }

  function toHexValue(value) {
    return `0x${BigInt(value || 0).toString(16)}`;
  }

  function decodeUint256(hex) {
    if (!hex || hex === '0x') {
      return 0n;
    }
    return BigInt(hex);
  }

  function decodeBool(hex) {
    return decodeUint256(hex) !== 0n;
  }

  function shortAddress(address) {
    const value = String(address || '');
    return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
  }

  function formatDate(timestamp) {
    const value = Number(timestamp || 0);
    if (!Number.isFinite(value) || value <= 0) {
      return '--';
    }
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value * 1000));
  }

  function formatPrice(raw, decimals, symbol) {
    const amount = BigInt(raw || 0);
    const unit = 10n ** BigInt(decimals || 0);
    const whole = amount / unit;
    const fraction = amount % unit;
    const fractionText = fraction === 0n
      ? ''
      : `.${fraction.toString().padStart(Number(decimals || 0), '0').replace(/0+$/, '')}`;
    return `${whole.toString()}${fractionText} ${symbol || ''}`.trim();
  }

  function isNativePayment(config) {
    return Boolean(
      config &&
      (
        config.paymentMode === 'native' ||
        !config.paymentToken ||
        String(config.paymentToken.address || '').toLowerCase() === '0x0000000000000000000000000000000000000000'
      )
    );
  }

  function isConfigured(config) {
    return Boolean(
      config &&
      config.enabled &&
      isAddress(config.contractAddress) &&
      (
        isNativePayment(config) ||
        (config.paymentToken && isAddress(config.paymentToken.address))
      )
    );
  }

  function featureEnabled(config, featureId) {
    if (!config || !config.enabled) {
      return false;
    }

    if (!config.features || typeof config.features[featureId] === 'undefined') {
      return true;
    }

    return Boolean(config.features[featureId]);
  }

  function errorMessage(error, fallback) {
    if (error && Number(error.code) === 4001) {
      return 'Wallet request rejected.';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback || 'Lab Pass verification failed.';
  }

  global.B20PremiumUtils = {
    selectors,
    isAddress,
    normalizeAddress,
    padAddress,
    padUint256,
    toHexValue,
    decodeUint256,
    decodeBool,
    shortAddress,
    formatDate,
    formatPrice,
    isNativePayment,
    isConfigured,
    featureEnabled,
    errorMessage
  };
})(window);
