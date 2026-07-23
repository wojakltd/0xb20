(function (global) {
  const utils = global.B20PremiumUtils;
  const wallet = global.B20PremiumWallet;
  const contract = global.B20PremiumContract;
  const license = global.B20PremiumLicense;
  const modal = global.B20PremiumModal;

  const subscribers = new Set();
  const state = {
    initialized: false,
    config: null,
    wallet: null,
    license: license.createLicenseStore(),
    checking: false,
    error: ''
  };

  function snapshot() {
    return {
      initialized: state.initialized,
      config: state.config,
      wallet: state.wallet,
      license: { ...state.license },
      checking: state.checking,
      error: state.error
    };
  }

  function emit() {
    const current = snapshot();
    subscribers.forEach((callback) => callback(current));
  }

  async function loadConfig(configUrl) {
    const response = await fetch(configUrl || '/data/web3-tools.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Premium configuration unavailable.');
    }
    const data = await response.json();
    return data.premium || null;
  }

  async function refreshLicense() {
    if (!state.config || !global.B20Wallet) {
      return state.license;
    }

    const walletState = global.B20Wallet.getState();
    state.wallet = walletState;

    if (!walletState.connected || !walletState.address || !utils.isConfigured(state.config)) {
      state.license = license.createLicenseStore();
      state.license.error = utils.isConfigured(state.config) ? '' : 'Lab Pass contract is not configured yet.';
      emit();
      return state.license;
    }

    state.checking = true;
    emit();

    try {
      const raw = await contract.readLicense(state.config, walletState.address);
      state.license = license.normalizeLicense(raw);
      state.error = '';
    } catch (error) {
      state.license = license.createLicenseStore();
      state.license.error = utils.errorMessage(error, 'Lab Pass check failed.');
      state.error = state.license.error;
    } finally {
      state.checking = false;
      emit();
    }

    return state.license;
  }

  async function refreshLicenseWithRetry(attempts = 6, delayMs = 1500) {
    let current = await refreshLicense();

    for (let attempt = 1; attempt < attempts && !current.active; attempt++) {
      await new Promise((resolve) => global.setTimeout(resolve, delayMs));
      current = await refreshLicense();
    }

    return current;
  }

  async function connectAndVerifyLicense(progress) {
    if (typeof progress === 'function') {
      progress('Connecting wallet...');
    }

    const connected = await wallet.ensureConnected();
    state.wallet = connected;

    if (typeof progress === 'function') {
      progress(`Switching to ${state.config.network || 'BASE'}...`);
    }

    state.wallet = await wallet.ensureNetwork(state.config);

    if (typeof progress === 'function') {
      progress('Checking Lab Pass on-chain...');
    }

    await contract.requireDeployedContract(state.config);
    return refreshLicense();
  }

  async function ensureUnlocked(featureId, featureLabel) {
    if (!state.config || !state.config.enabled || !utils.featureEnabled(state.config, featureId)) {
      return true;
    }

    await global.B20Wallet.init({ autoRestore: true });
    await refreshLicense();

    if (state.license.active) {
      return true;
    }

    if (!utils.isConfigured(state.config)) {
      throw new Error('Lab Pass contract is not configured yet.');
    }

    const verifiedLicense = await connectAndVerifyLicense();

    if (verifiedLicense.active) {
      return true;
    }

    const unlocked = await modal.openUnlock({
      config: state.config,
      walletState: state.wallet || global.B20Wallet.getState(),
      featureLabel,
      onUnlock: async (progress) => {
        const currentLicense = await connectAndVerifyLicense(progress);

        if (currentLicense.active) {
          progress('Lab Pass already active.');
          return;
        }

        await contract.approveExactPayment(state.config, state.wallet.address, progress);
        await contract.purchaseLicense(state.config, progress);

        progress('Verifying license on-chain...');
        await refreshLicenseWithRetry();

        if (!state.license.active) {
          throw new Error('License transaction confirmed, but Lab Pass is not active yet.');
        }
      }
    });

    return Boolean(unlocked);
  }

  async function init(options = {}) {
    if (state.initialized) {
      emit();
      return snapshot();
    }

    state.initialized = true;

    try {
      state.config = await loadConfig(options.configUrl);

      if (global.B20Wallet) {
        await global.B20Wallet.init({ autoRestore: true });
        wallet.subscribe((walletState) => {
          state.wallet = walletState;

          if (!walletState.connected || !walletState.address) {
            state.license = license.createLicenseStore();
            emit();
            return;
          }

          emit();

          if (utils.isConfigured(state.config)) {
            refreshLicense();
          }
        });
      }

      await refreshLicense();
    } catch (error) {
      state.error = utils.errorMessage(error, 'Premium Core unavailable.');
      state.license.error = state.error;
      emit();
    }

    return snapshot();
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    subscribers.add(callback);
    callback(snapshot());

    return () => subscribers.delete(callback);
  }

  global.B20Premium = {
    init,
    subscribe,
    refreshLicense,
    hasActiveLabPass: async () => (await refreshLicense()).active,
    requireAccess: ensureUnlocked,
    getState: snapshot
  };
})(window);
