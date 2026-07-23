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
      this.maxExportPages = Number(config.maxExportPages) || 1000;
      this.retryDelaysMs = config.retryDelaysMs || [800, 1600, 3200];
      this.holderPageCache = new Map();
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

    async loadAllHolderPages(address, token, pageParams, knownHolders = [], options = {}) {
      const normalizedAddress = this.normalizeInput(address);
      const startedAt = Date.now();
      const knownAddresses = new Set(
        (knownHolders || [])
          .map((holder) => addressKey(holder.address))
          .filter(Boolean)
      );
      const newHolders = [];
      const visitedCursors = new Set();
      let nextPageParams = pageParams || null;
      let duplicatesRemoved = 0;
      let pagesLoaded = 0;
      let partialError = '';

      if (!nextPageParams) {
        return {
          holders: [],
          meta: this.exportMeta({
            startedAt,
            pagesLoaded,
            walletsLoaded: knownAddresses.size,
            duplicatesRemoved,
            partialError,
            nextPageParams
          })
        };
      }

      while (nextPageParams && pagesLoaded < this.maxExportPages) {
        const cursorKey = this.cacheKey(normalizedAddress, nextPageParams);

        if (visitedCursors.has(cursorKey)) {
          partialError = 'Provider cursor repeated. Export stopped to avoid duplicate requests.';
          break;
        }

        visitedCursors.add(cursorKey);
        pagesLoaded += 1;

        const pageNumber = (Number(options.startPageNumber) || 2) + pagesLoaded - 1;
        this.exportProgress(options, {
          pagesLoaded,
          walletsLoaded: knownAddresses.size,
          duplicatesRemoved,
          currentPage: pageNumber,
          expectedTotal: options.expectedTotal || null,
          message: `Loading page ${pageNumber}...`
        });

        let holderResponse;

        try {
          holderResponse = await this.readHolderBatchWithRetry(normalizedAddress, token, nextPageParams, options);
        } catch (error) {
          if (this.isAbort(error)) {
            throw error;
          }

          partialError = error.message || 'Provider became unavailable during export.';
          break;
        }

        for (const holder of holderResponse.holders || []) {
          const key = addressKey(holder.address);

          if (!key || knownAddresses.has(key)) {
            duplicatesRemoved += 1;
            continue;
          }

          knownAddresses.add(key);
          newHolders.push(holder);
        }

        nextPageParams = holderResponse.nextPageParams || null;

        this.exportProgress(options, {
          pagesLoaded,
          walletsLoaded: knownAddresses.size,
          duplicatesRemoved,
          currentPage: pageNumber,
          expectedTotal: options.expectedTotal || null,
          moreAvailable: Boolean(nextPageParams),
          message: nextPageParams ? 'Loading holders...' : 'Preparing export...'
        });
      }

      if (pagesLoaded >= this.maxExportPages && nextPageParams && !partialError) {
        partialError = `Provider export page limit reached (${this.maxExportPages}).`;
      }

      return {
        holders: newHolders,
        meta: this.exportMeta({
          startedAt,
          pagesLoaded,
          walletsLoaded: knownAddresses.size,
          duplicatesRemoved,
          partialError,
          nextPageParams
        })
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

    exportProgress(options, payload) {
      if (typeof options.onExportProgress === 'function') {
        options.onExportProgress({
          provider: this.label,
          ...payload
        });
      }
    }

    exportMeta({ startedAt, pagesLoaded, walletsLoaded, duplicatesRemoved, partialError, nextPageParams }) {
      return {
        provider: this.label,
        providerId: this.id,
        network: this.network,
        durationMs: Date.now() - startedAt,
        lastUpdated: new Date().toISOString(),
        moreAvailable: Boolean(nextPageParams),
        nextPageParams: nextPageParams || null,
        pagesLoaded,
        walletsLoaded,
        duplicatesRemoved,
        partialError,
        completed: !partialError && !nextPageParams
      };
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
      const key = this.cacheKey(address, pageParams);

      if (this.holderPageCache.has(key)) {
        return this.cloneHolderResponse(this.holderPageCache.get(key));
      }

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

      const result = {
        holders: this.normalizeHolders(collected.slice(0, this.maxHolders), token),
        nextPageParams,
        rawItemCount
      };

      this.holderPageCache.set(key, this.cloneHolderResponse(result));
      return result;
    }

    async readHolderBatchWithRetry(address, token, pageParams, options) {
      let attempt = 0;

      while (true) {
        try {
          return await this.readHolderBatch(address, token, pageParams, options);
        } catch (error) {
          if (this.isAbort(error) || !this.isRetryable(error) || attempt >= this.retryDelaysMs.length) {
            throw error;
          }

          const delay = this.retryDelaysMs[attempt];
          attempt += 1;
          this.progress(options, 40, `Provider retry ${attempt} after ${delay}ms...`);
          await this.sleep(delay, options.signal);
        }
      }
    }

    cacheKey(address, pageParams) {
      return `${addressKey(address)}:${this.maxHolders}:${this.serializePageParams(pageParams)}`;
    }

    serializePageParams(pageParams) {
      if (!pageParams || typeof pageParams !== 'object') {
        return 'first';
      }

      return Object.keys(pageParams)
        .sort()
        .map((key) => `${key}:${String(pageParams[key])}`)
        .join('|');
    }

    cloneHolderResponse(response) {
      return {
        holders: (response.holders || []).map((holder) => ({
          ...holder,
          labels: [...(holder.labels || [])]
        })),
        nextPageParams: response.nextPageParams ? { ...response.nextPageParams } : null,
        rawItemCount: response.rawItemCount || 0
      };
    }

    sleep(ms, signal) {
      return new Promise((resolve, reject) => {
        let timeout;

        const cleanup = () => {
          window.clearTimeout(timeout);
          if (signal) {
            signal.removeEventListener('abort', abort);
          }
        };

        const done = () => {
          cleanup();
          resolve();
        };

        const abort = () => {
          cleanup();
          reject(new DOMException('Operation cancelled.', 'AbortError'));
        };

        timeout = window.setTimeout(done, ms);

        if (signal) {
          if (signal.aborted) {
            abort();
            return;
          }

          signal.addEventListener('abort', abort, { once: true });
        }
      });
    }

    isRetryable(error) {
      const message = String(error?.message || '').toLowerCase();

      return [
        'timed out',
        'rate limit',
        'unavailable',
        'rejected',
        'failed',
        'temporarily'
      ].some((fragment) => message.includes(fragment));
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
