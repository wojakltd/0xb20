(function (global) {
  const storageKey = 'b20-referrer-wallet';

  function isAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
  }

  function readStoredReferrer() {
    try {
      const value = global.localStorage.getItem(storageKey);
      return isAddress(value) ? value : '';
    } catch (error) {
      return '';
    }
  }

  function storeReferrer(value) {
    if (!isAddress(value) || readStoredReferrer()) {
      return readStoredReferrer();
    }

    try {
      global.localStorage.setItem(storageKey, value);
    } catch (error) {
      // Referral capture must never break public pages.
    }

    return value;
  }

  function captureFromUrl() {
    const params = new URLSearchParams(global.location.search);
    const referrer = params.get('ref') || params.get('referrer') || '';
    return storeReferrer(referrer);
  }

  global.B20ReferralCapture = {
    captureFromUrl,
    readStoredReferrer,
    storeReferrer
  };

  captureFromUrl();
})(window);
