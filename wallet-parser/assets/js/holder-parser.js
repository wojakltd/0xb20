(function () {
  class WalletHolderScanner {
    constructor(provider) {
      this.provider = provider;
      this.abortController = null;
      this.active = false;
    }

    isActive() {
      return this.active;
    }

    cancel() {
      if (this.abortController) {
        this.abortController.abort();
      }
    }

    async scan(address, options = {}) {
      if (this.active) {
        throw new Error('Scan already running.');
      }

      this.active = true;
      this.abortController = new AbortController();

      try {
        return await this.provider.scanToken(address, {
          ...options,
          signal: this.abortController.signal
        });
      } finally {
        this.active = false;
        this.abortController = null;
      }
    }

    async loadPage(address, token, pageParams, options = {}) {
      if (this.active) {
        throw new Error('Scan already running.');
      }

      if (!this.provider || typeof this.provider.loadHolderPage !== 'function') {
        throw new Error('Provider pagination is not available.');
      }

      this.active = true;
      this.abortController = new AbortController();

      try {
        return await this.provider.loadHolderPage(address, token, pageParams, {
          ...options,
          signal: this.abortController.signal
        });
      } finally {
        this.active = false;
        this.abortController = null;
      }
    }

    async loadAllPages(address, token, pageParams, knownHolders, options = {}) {
      if (this.active) {
        throw new Error('Scan already running.');
      }

      if (!this.provider || typeof this.provider.loadAllHolderPages !== 'function') {
        throw new Error('Provider global export is not available.');
      }

      this.active = true;
      this.abortController = new AbortController();

      try {
        return await this.provider.loadAllHolderPages(address, token, pageParams, knownHolders, {
          ...options,
          signal: this.abortController.signal
        });
      } finally {
        this.active = false;
        this.abortController = null;
      }
    }
  }

  window.B20HolderParser = {
    WalletHolderScanner
  };
})();
