(function (global) {
  function createLicenseStore() {
    return {
      active: false,
      expiration: 0,
      expiresAtLabel: '--',
      checkedAt: 0,
      error: ''
    };
  }

  function normalizeLicense(raw) {
    return {
      active: Boolean(raw && raw.active),
      expiration: Number(raw && raw.expiration ? raw.expiration : 0),
      expiresAtLabel: raw && raw.expiresAtLabel ? raw.expiresAtLabel : '--',
      checkedAt: Date.now(),
      error: ''
    };
  }

  global.B20PremiumLicense = {
    createLicenseStore,
    normalizeLicense
  };
})(window);
