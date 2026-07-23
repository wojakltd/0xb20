(function () {
  const { BaseProvider } = window.B20ParserProvider;
  const {
    isAddress,
    addressKey,
    formatTokenAmount,
    formatPercentage,
    percentageNumber,
    safeText
  } = window.B20ParserUtils;
  const labels = window.B20ParserLabels;

  class BlockscoutProvider extends BaseProvider {
    constructor(config = {}) {
      super({
        id: 'blockscout',
        label: 'Blockscout API',
        network: 'BASE',
        maxHolders: 100,
        ...config
      });

      this.apiBase = config.apiBase || 'https://base.blockscout.com/api/v2';
      this.rpcUrl = config.rpcUrl || 'https://mainnet.base.org';
      this.timeoutMs = config.timeoutMs || 30000;
      this.pageSize = Math.min(Number(config.pageSize) || 50, 50);
    }

    async scanToken(address, options = {}) {
      const normalizedAddress = this.normalizeInput(address);
      const startedAt = Date.now();

      this.progress(options, 8, 'Validating contract address...');
      await this.requireContractCode(normalizedAddress, options);

      this.progress(options, 24, 'Reading ERC-20 token metadata...');
      const token = await this.readTokenInfo(normalizedAddress, options);

      this.progress(options, 46, 'Reading indexed holder balances...');
      const holderResponse = await this.readHolderBatch(normalizedAddress, token, null, options);

      this.progress(options, 82, 'Filtering holder list...');

      this.progress(options, 100, 'Wallet parser scan complete.');

      return {
        token,
        holders: holderResponse.holders,
        meta: {
          provider: this.label,
          providerId: this.id,
          network: this.network,
          durationMs: Date.now() - startedAt,
          lastUpdated: new Date().toISOString(),
          moreAvailable: Boolean(holderResponse.nextPageParams),
          nextPageParams: holderResponse.nextPageParams,
          rawHolderCount: holderResponse.rawItemCount
        }
      };
    }

    async loadHolderPage(address, token, pageParams, options = {}) {
      const normalizedAddress = this.normalizeInput(address);
      const startedAt = Date.now();

      this.progress(options, 12, 'Loading next indexed holder page...');
      const holderResponse = await this.readHolderBatch(normalizedAddress, token, pageParams || null, options);

      this.progress(options, 100, 'Holder page loaded.');

      return {
        holders: holderResponse.holders,
        meta: {
          provider: this.label,
          providerId: this.id,
          network: this.network,
          durationMs: Date.now() - startedAt,
          lastUpdated: new Date().toISOString(),
          moreAvailable: Boolean(holderResponse.nextPageParams),
          nextPageParams: holderResponse.nextPageParams,
          rawHolderCount: holderResponse.rawItemCount
        }
      };
    }

    normalizeInput(address) {
      const normalized = String(address || '').trim();

      if (!isAddress(normalized)) {
        throw new Error('Invalid contract address.');
      }

      return normalized;
    }

    progress(options, value, text) {
      if (typeof options.onProgress === 'function') {
        options.onProgress({ value, text });
      }
    }

    async requireContractCode(address, options) {
      try {
        const code = await this.rpc('eth_getCode', [address, 'latest'], options.signal);

        if (!code || String(code).toLowerCase() === '0x') {
          throw new Error('No bytecode found at this address.');
        }

        return code;
      } catch (error) {
        if (this.isAbort(error)) {
          throw error;
        }

        const indexedAddress = await this.readAddressInfo(address, options).catch(() => null);

        if (!indexedAddress || indexedAddress.is_contract !== true) {
          throw new Error('Contract bytecode could not be verified on Base.');
        }

        return 'indexed-contract';
      }
    }

    async readTokenInfo(address, options) {
      const token = await this.fetchJson(`${this.apiBase}/tokens/${address}`, options.signal);

      if (!token || token.type !== 'ERC-20') {
        throw new Error('Address is not an indexed ERC-20 token on Base.');
      }

      const decimals = Number(token.decimals);

      if (!Number.isFinite(decimals)) {
        throw new Error('ERC-20 metadata is incomplete.');
      }

      return {
        address: token.address_hash || address,
        name: safeText(token.name),
        symbol: safeText(token.symbol),
        decimals,
        totalSupplyRaw: String(token.total_supply || '0'),
        totalSupply: formatTokenAmount(token.total_supply || '0', decimals, 4),
        holdersCount: token.holders_count || token.holders || null,
        type: token.type
      };
    }

    async readAddressInfo(address, options) {
      return this.fetchJson(`${this.apiBase}/addresses/${address}`, options.signal);
    }

    addressUrl(address) {
      return `https://base.blockscout.com/address/${address}`;
    }

    async readHolderBatch(address, token, pageParams, options) {
      const collected = [];
      let nextPageParams = pageParams || null;
      let rawItemCount = 0;

      do {
        const remaining = this.maxHolders - collected.length;
        const url = this.holdersUrl(address, nextPageParams, remaining);
        const response = await this.fetchJson(url, options.signal);
        const items = Array.isArray(response.items) ? response.items : [];

        rawItemCount += items.length;
        collected.push(...items);
        nextPageParams = response.next_page_params || null;

        this.progress(options, Math.min(78, 50 + collected.length), `Indexed holders loaded: ${Math.min(collected.length, this.maxHolders)} / ${this.maxHolders}`);
      } while (collected.length < this.maxHolders && nextPageParams);

      return {
        holders: this.normalizeHolders(collected.slice(0, this.maxHolders), token),
        nextPageParams,
        rawItemCount
      };
    }

    holdersUrl(address, pageParams, remaining) {
      const url = new URL(`${this.apiBase}/tokens/${address}/holders`);
      const itemsCount = Math.max(1, Math.min(this.pageSize, remaining || this.pageSize));
      url.searchParams.set('items_count', String(itemsCount));

      if (pageParams && typeof pageParams === 'object') {
        Object.entries(pageParams).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            url.searchParams.set(key, String(value));
          }
        });
      }

      return url.toString();
    }

    normalizeHolders(items, token) {
      const seen = new Set();
      const holders = [];

      for (const item of items || []) {
        const address = item?.address?.hash || item?.address_hash || item?.hash || '';
        const key = addressKey(address);

        if (!isAddress(address) || seen.has(key)) {
          continue;
        }

        seen.add(key);

        const valueRaw = String(item.value || '0');

        if (BigInt(valueRaw) <= 0n) {
          continue;
        }

        const isContract = item?.address?.is_contract === true;
        const normalizedHolder = {
          rank: holders.length + 1,
          address,
          valueRaw,
          balance: formatTokenAmount(valueRaw, token.decimals, 6),
          percentage: formatPercentage(valueRaw, token.totalSupplyRaw),
          percentageValue: percentageNumber(valueRaw, token.totalSupplyRaw),
          isContract,
          label: item?.address?.name || this.readTagName(item?.address)
        };

        normalizedHolder.labels = labels.labelsForHolder(normalizedHolder);
        holders.push(normalizedHolder);
      }

      return holders;
    }

    readTagName(addressInfo) {
      const tags = addressInfo?.metadata?.tags;

      if (!Array.isArray(tags) || !tags.length) {
        return '';
      }

      const nameTag = tags.find((tag) => tag?.tagType === 'name' && tag?.name);
      return nameTag?.name || tags[0]?.name || '';
    }

    async rpc(method, params, signal) {
      const response = await this.fetchJson(this.rpcUrl, signal, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params
        })
      });

      if (response.error) {
        throw new Error(response.error.message || 'Base RPC rejected the request.');
      }

      return response.result;
    }

    async fetchJson(url, externalSignal, init = {}) {
      const controller = new AbortController();
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.timeoutMs);

      const abortFromParent = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener('abort', abortFromParent, { once: true });
        }
      }

      try {
        const response = await fetch(url, {
          cache: 'no-store',
          ...init,
          signal: controller.signal
        });

        if (!response.ok) {
          throw this.httpError(response.status);
        }

        return await response.json();
      } catch (error) {
        if (this.isAbort(error)) {
          if (timedOut && !(externalSignal && externalSignal.aborted)) {
            throw new Error('Provider request timed out. Try again later.');
          }

          throw error;
        }

        throw error instanceof Error ? error : new Error('Provider request failed.');
      } finally {
        window.clearTimeout(timeout);
        if (externalSignal) {
          externalSignal.removeEventListener('abort', abortFromParent);
        }
      }
    }

    httpError(status) {
      if (status === 404) {
        return new Error('Token is not indexed yet or contract is not ERC-20.');
      }

      if (status === 429) {
        return new Error('Blockscout rate limit reached. Try again later.');
      }

      if (status === 422) {
        return new Error('Provider rejected the request. Token may be temporarily unavailable or not fully indexed.');
      }

      if (status >= 500) {
        return new Error('Blockscout unavailable. Observation source offline.');
      }

      return new Error(`Provider request rejected (${status}).`);
    }

    isAbort(error) {
      return error && error.name === 'AbortError';
    }
  }

  window.B20BlockscoutProvider = {
    BlockscoutProvider
  };
})();
