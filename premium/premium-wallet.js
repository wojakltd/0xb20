(function (global) {
  function wallet() {
    if (!global.B20Wallet) {
      throw new Error('Wallet layer unavailable.');
    }
    return global.B20Wallet;
  }

  async function ensureConnected() {
    const service = wallet();
    await service.init({ autoRestore: true });

    let state = service.getState();
    if (!state.connected || !state.address) {
      state = await service.connect();
    }

    return state;
  }

  async function ensureNetwork(config) {
    const service = wallet();
    let state = service.getState();

    if (state.chainId !== config.chainId) {
      state = await service.switchToBase();
    }

    if (state.chainId !== config.chainId) {
      throw new Error(`Switch wallet to ${config.network || 'BASE'}.`);
    }

    return state;
  }

  function subscribe(callback) {
    return wallet().subscribe(callback);
  }

  global.B20PremiumWallet = {
    ensureConnected,
    ensureNetwork,
    subscribe
  };
})(window);
