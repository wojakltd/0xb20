(function () {
  /**
   * Provider contract used by the Wallet Parser UI.
   *
   * A provider must expose:
   * - id: stable machine name
   * - label: human readable data source name
   * - network: target network label
   * - maxHolders: current page size
   * - scanToken(address, options): Promise<{ token, holders, meta }>
   *
   * Future providers can wrap BaseScan, Moralis, Bitquery, an internal indexer,
   * or Transfer log reconstruction without changing the UI layer.
   */
  class BaseProvider {
    constructor(config) {
      this.id = config.id;
      this.label = config.label;
      this.network = config.network || 'BASE';
      this.maxHolders = config.maxHolders || 100;
    }

    async scanToken() {
      throw new Error('Provider scanToken() is not implemented.');
    }
  }

  window.B20ParserProvider = {
    BaseProvider
  };
})();
