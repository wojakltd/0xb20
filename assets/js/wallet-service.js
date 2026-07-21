(function (global) {
  const defaultConfig = {
    storageKey: 'b20-wallet-session',
    walletConnectProjectId: '917508eb683075298f4c297df0bf21d1',
    baseChainId: '0x2105',
    appName: '0XB20 Laboratory',
    appDescription: 'Global wallet infrastructure for 0XB20 Laboratory tools.',
    appUrl: 'https://0xb20.lol',
    appIcon: 'https://0xb20.lol/favicon.png',
    autoRestore: true
  };

  const baseChainParams = {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org']
  };

  const chainNames = {
    '0x1': 'ETHEREUM',
    '0x2105': 'BASE',
    '0xa': 'OPTIMISM',
    '0xa4b1': 'ARBITRUM',
    '0x89': 'POLYGON',
    '0x38': 'BNB',
    '0xaa36a7': 'SEPOLIA',
    '0x14a34': 'BASE SEPOLIA'
  };

  const subscribers = new Set();
  const attachedProviders = new WeakSet();
  let config = { ...defaultConfig };
  let discoveryPromise = null;
  let restorePromise = null;

  const state = {
    initialized: false,
    discoveryListening: false,
    restoring: false,
    providers: [],
    selectedProviderId: '',
    provider: null,
    walletName: '',
    address: '',
    chainId: '',
    balance: '',
    profile: null,
    status: 'DISCONNECTED',
    message: 'Wallet layer idle.',
    error: '',
    connected: false,
    lastUpdatedAt: ''
  };

  function normalizeChainId(chainId) {
    if (!chainId) {
      return '';
    }

    if (typeof chainId === 'number') {
      return `0x${chainId.toString(16)}`;
    }

    return String(chainId).toLowerCase();
  }

  function networkName(chainId) {
    const normalized = normalizeChainId(chainId);
    return chainNames[normalized] || `UNKNOWN (${chainId || '--'})`;
  }

  function shortAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';
  }

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

  function stripHexPrefix(value) {
    return String(value || '').replace(/^0x/i, '');
  }

  function padHex(value, length) {
    return stripHexPrefix(value).padStart(length, '0');
  }

  function padAddress(address) {
    return padHex(normalizeAddress(address), 64);
  }

  function padUint256(value) {
    const amount = typeof value === 'bigint' ? value : BigInt(value);

    if (amount < 0n) {
      throw new Error('Amount cannot be negative.');
    }

    return amount.toString(16).padStart(64, '0');
  }

  function formatEthBalance(hexBalance) {
    try {
      return `${formatUnits(BigInt(hexBalance || '0x0'), 18, 4)} ETH`;
    } catch (error) {
      return 'Unavailable';
    }
  }

  function parseUnits(value, decimals) {
    const normalized = String(value || '').trim().replace(',', '.');

    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      throw new Error('Invalid amount.');
    }

    const [whole, fraction = ''] = normalized.split('.');
    const tokenDecimals = Number(decimals);

    if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 255) {
      throw new Error('Invalid token decimals.');
    }

    if (fraction.length > tokenDecimals) {
      throw new Error(`Amount exceeds token decimals (${tokenDecimals}).`);
    }

    const paddedFraction = fraction.padEnd(tokenDecimals, '0');
    return BigInt(`${whole}${paddedFraction}` || '0');
  }

  function formatUnits(value, decimals, maxFraction = 6) {
    const amount = typeof value === 'bigint' ? value : BigInt(value || 0);
    const tokenDecimals = Number(decimals);
    const base = 10n ** BigInt(tokenDecimals);
    const whole = amount / base;
    const fraction = amount % base;

    if (!fraction) {
      return whole.toString();
    }

    const fractionText = fraction
      .toString()
      .padStart(tokenDecimals, '0')
      .slice(0, maxFraction)
      .replace(/0+$/, '');

    return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
  }

  function hexToText(hex) {
    const clean = stripHexPrefix(hex).replace(/00+$/g, '');

    if (!clean) {
      return '';
    }

    const bytes = clean.match(/.{1,2}/g).map((pair) => Number.parseInt(pair, 16));
    return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\0/g, '').trim();
  }

  function decodeAbiString(hex) {
    const body = stripHexPrefix(hex);

    if (!body) {
      return '';
    }

    try {
      if (body.length === 64) {
        return hexToText(body);
      }

      const offset = Number(BigInt(`0x${body.slice(0, 64)}`)) * 2;
      const length = Number(BigInt(`0x${body.slice(offset, offset + 64)}`)) * 2;
      return hexToText(body.slice(offset + 64, offset + 64 + length));
    } catch (error) {
      return '';
    }
  }

  function publicProvider(provider) {
    const { provider: ignoredProvider, ...safeProvider } = provider;
    return safeProvider;
  }

  function snapshot() {
    return {
      initialized: state.initialized,
      restoring: state.restoring,
      providers: state.providers.map(publicProvider),
      selectedProviderId: state.selectedProviderId,
      walletName: state.walletName,
      address: state.address,
      shortAddress: shortAddress(state.address),
      chainId: state.chainId,
      network: networkName(state.chainId),
      balance: state.balance,
      profile: state.profile ? { ...state.profile } : null,
      status: state.status,
      message: state.message,
      error: state.error,
      connected: state.connected,
      lastUpdatedAt: state.lastUpdatedAt,
      baseChainId: config.baseChainId,
      isBase: normalizeChainId(state.chainId) === normalizeChainId(config.baseChainId)
    };
  }

  function emit() {
    const detail = snapshot();

    subscribers.forEach((subscriber) => {
      try {
        subscriber(detail);
      } catch (error) {
        // Subscribers should not be able to break the shared wallet layer.
      }
    });

    global.dispatchEvent(new CustomEvent('b20-wallet:update', { detail }));
  }

  function setState(patch) {
    Object.assign(state, patch, { lastUpdatedAt: new Date().toISOString() });
    emit();
  }

  function readStoredSession() {
    try {
      const raw = global.localStorage.getItem(config.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredSession(provider) {
    try {
      global.localStorage.setItem(config.storageKey, JSON.stringify({
        connected: true,
        providerId: provider.id,
        walletName: provider.name,
        type: provider.type,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Wallet persistence is best-effort. Never block the interface.
    }
  }

  function clearStoredSession() {
    try {
      global.localStorage.removeItem(config.storageKey);
    } catch (error) {
      // Storage can be unavailable in privacy modes.
    }
  }

  function providerId(info) {
    return info.uuid || info.rdns || info.name || `provider-${state.providers.length}`;
  }

  function inferLegacyName(provider) {
    if (provider && provider.isRabby) {
      return 'Rabby';
    }

    if (provider && provider.isCoinbaseWallet) {
      return 'Coinbase Wallet';
    }

    if (provider && provider.isRainbow) {
      return 'Rainbow';
    }

    if (provider && provider.isMetaMask) {
      return 'MetaMask';
    }

    return 'Injected Wallet';
  }

  function addProvider(provider, info = {}) {
    if (!provider) {
      return;
    }

    const entry = {
      id: providerId(info),
      name: info.name || inferLegacyName(provider),
      rdns: info.rdns || '',
      icon: info.icon || '',
      provider,
      type: 'injected',
      disabled: false
    };

    const duplicate = state.providers.some((candidate) => (
      candidate.provider === provider || candidate.id === entry.id
    ));

    if (!duplicate) {
      state.providers.push(entry);
    }
  }

  function addWalletConnectAdapter() {
    if (state.providers.some((provider) => provider.type === 'walletconnect')) {
      return;
    }

    state.providers.push({
      id: 'walletconnect',
      name: 'WalletConnect',
      rdns: 'walletconnect.com',
      icon: '',
      provider: null,
      type: 'walletconnect',
      disabled: !config.walletConnectProjectId
    });
  }

  function discoverLegacyProviders() {
    const ethereum = global.ethereum;

    if (!ethereum) {
      return;
    }

    if (Array.isArray(ethereum.providers)) {
      ethereum.providers.forEach((provider) => addProvider(provider));
      return;
    }

    addProvider(ethereum);
  }

  function handleProviderAnnouncement(event) {
    const detail = event.detail || {};
    addProvider(detail.provider, detail.info || {});
    emit();
  }

  function discoverWallets() {
    if (discoveryPromise) {
      return discoveryPromise;
    }

    state.providers = [];
    state.selectedProviderId = '';

    if (!state.discoveryListening) {
      global.addEventListener('eip6963:announceProvider', handleProviderAnnouncement);
      state.discoveryListening = true;
    }

    global.dispatchEvent(new Event('eip6963:requestProvider'));

    discoveryPromise = new Promise((resolve) => {
      global.setTimeout(() => {
        discoverLegacyProviders();
        addWalletConnectAdapter();

        const firstEnabled = state.providers.find((provider) => !provider.disabled);
        const stored = readStoredSession();

        state.selectedProviderId = stored && stored.providerId
          ? stored.providerId
          : firstEnabled
            ? firstEnabled.id
            : '';

        discoveryPromise = null;
        emit();
        resolve(snapshot().providers);
      }, 350);
    });

    return discoveryPromise;
  }

  async function createWalletConnectProvider(connectRequested) {
    if (!config.walletConnectProjectId) {
      throw new Error('WalletConnect project id is not configured.');
    }

    const walletConnectModule = await import('https://esm.sh/@walletconnect/ethereum-provider@2');
    const provider = await walletConnectModule.default.init({
      projectId: config.walletConnectProjectId,
      chains: [8453],
      optionalChains: [1, 10, 42161, 137],
      showQrModal: true,
      metadata: {
        name: config.appName,
        description: config.appDescription,
        url: config.appUrl,
        icons: [config.appIcon]
      }
    });

    if (connectRequested) {
      await provider.connect();
    }

    return provider;
  }

  async function resolveProfile(address) {
    try {
      const response = await fetch(`https://api.web3.bio/profile/${address}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const profiles = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.profiles)
          ? payload.profiles
          : [];
      const baseName = profiles.find((profile) => /base/i.test(`${profile.platform || ''} ${profile.network || ''} ${profile.identity || ''}`));
      const ens = profiles.find((profile) => /ens|ethereum/i.test(`${profile.platform || ''} ${profile.network || ''}`));
      const preferred = baseName || ens || profiles[0] || null;

      return {
        baseName: baseName ? baseName.identity || baseName.name || baseName.displayName || '' : '',
        ens: ens ? ens.identity || ens.name || ens.displayName || '' : '',
        avatar: preferred ? preferred.avatar || preferred.image || preferred.profileImage || '' : ''
      };
    } catch (error) {
      return null;
    }
  }

  async function request(provider, method, params) {
    if (!provider || typeof provider.request !== 'function') {
      throw new Error('Wallet provider unavailable.');
    }

    return provider.request({ method, params });
  }

  async function readWalletState(provider, walletName) {
    setState({
      status: 'SCANNING',
      message: 'SCANNING SPECIMEN...',
      error: ''
    });

    const [accounts, chainId] = await Promise.all([
      request(provider, 'eth_accounts'),
      request(provider, 'eth_chainId')
    ]);
    const address = accounts && accounts[0] ? accounts[0] : '';

    if (!address) {
      throw new Error('Wallet returned no active address.');
    }

    const balanceHex = await request(provider, 'eth_getBalance', [address, 'latest']);
    const profile = await resolveProfile(address);

    setState({
      provider,
      walletName,
      address,
      chainId: normalizeChainId(chainId),
      balance: formatEthBalance(balanceHex),
      profile,
      status: 'CONNECTED',
      message: 'Identity confirmed. Wallet layer synchronized.',
      error: '',
      connected: true
    });
  }

  function resetConnection(message = 'Wallet disconnected.') {
    setState({
      provider: null,
      walletName: '',
      address: '',
      chainId: '',
      balance: '',
      profile: null,
      status: 'DISCONNECTED',
      message,
      error: '',
      connected: false
    });
  }

  function attachProviderEvents(provider) {
    if (!provider || typeof provider.on !== 'function' || attachedProviders.has(provider)) {
      return;
    }

    attachedProviders.add(provider);

    provider.on('accountsChanged', (accounts) => {
      if (!accounts || !accounts[0]) {
        clearStoredSession();
        resetConnection('Wallet disconnected.');
        return;
      }

      readWalletState(provider, state.walletName).catch((error) => {
        setState({ status: 'ERROR', message: error.message, error: error.message });
      });
    });

    provider.on('chainChanged', () => {
      readWalletState(provider, state.walletName).catch((error) => {
        setState({ status: 'ERROR', message: error.message, error: error.message });
      });
    });

    provider.on('disconnect', () => {
      clearStoredSession();
      resetConnection('Wallet session closed.');
    });
  }

  async function connect(providerIdValue) {
    await discoverWallets();

    const selected = state.providers.find((provider) => provider.id === providerIdValue)
      || state.providers.find((provider) => !provider.disabled);

    if (!selected) {
      throw new Error('No compatible wallet detected.');
    }

    setState({
      selectedProviderId: selected.id,
      status: 'CONNECTING',
      message: `Connecting ${selected.name}...`,
      error: ''
    });

    try {
      const provider = selected.type === 'walletconnect'
        ? await createWalletConnectProvider(true)
        : selected.provider;

      await request(provider, 'eth_requestAccounts');
      attachProviderEvents(provider);
      await readWalletState(provider, selected.name);
      writeStoredSession(selected);
      return snapshot();
    } catch (error) {
      const message = error && error.message ? error.message : 'Wallet connection rejected.';
      setState({ status: 'ERROR', message, error: message, connected: false });
      throw error;
    }
  }

  async function restoreConnection() {
    if (restorePromise) {
      return restorePromise;
    }

    const stored = readStoredSession();

    if (!stored || !stored.connected) {
      return Promise.resolve(snapshot());
    }

    restorePromise = (async () => {
      setState({ restoring: true, message: 'Restoring wallet session...' });
      await discoverWallets();

      let selected = state.providers.find((provider) => provider.id === stored.providerId);

      if (!selected && stored.type === 'walletconnect') {
        selected = state.providers.find((provider) => provider.type === 'walletconnect');
      }

      if (!selected || selected.disabled) {
        clearStoredSession();
        resetConnection('Stored wallet provider unavailable.');
        return snapshot();
      }

      try {
        const provider = selected.type === 'walletconnect'
          ? await createWalletConnectProvider(false)
          : selected.provider;
        const accounts = await request(provider, 'eth_accounts');

        if (!accounts || !accounts[0]) {
          clearStoredSession();
          resetConnection('Wallet permission expired. Reconnect required.');
          return snapshot();
        }

        attachProviderEvents(provider);
        setState({ selectedProviderId: selected.id });
        await readWalletState(provider, selected.name || stored.walletName);
        return snapshot();
      } catch (error) {
        const message = error && error.message ? error.message : 'Wallet restore failed.';
        setState({ status: 'ERROR', message, error: message, connected: false });
        return snapshot();
      } finally {
        setState({ restoring: false });
        restorePromise = null;
      }
    })();

    return restorePromise;
  }

  async function disconnect() {
    const provider = state.provider;

    try {
      if (provider && typeof provider.disconnect === 'function') {
        await provider.disconnect();
      }
    } catch (error) {
      // Some injected wallets do not expose disconnect. Clearing local state is enough.
    }

    clearStoredSession();
    resetConnection('Wallet disconnected by host.');
    return snapshot();
  }

  async function signMessage(message) {
    if (!state.provider || !state.address) {
      throw new Error('Connect wallet before signing.');
    }

    return request(state.provider, 'personal_sign', [message, state.address]);
  }

  async function switchToBase() {
    if (!state.provider) {
      throw new Error('Connect wallet before switching network.');
    }

    try {
      await request(state.provider, 'wallet_switchEthereumChain', [{ chainId: config.baseChainId }]);
    } catch (error) {
      if (error && Number(error.code) === 4902) {
        await request(state.provider, 'wallet_addEthereumChain', [baseChainParams]);
        return snapshot();
      }

      throw error;
    }

    await readWalletState(state.provider, state.walletName);
    return snapshot();
  }

  async function ethCall(to, data) {
    if (!state.provider) {
      throw new Error('Connect wallet before reading chain data.');
    }

    return request(state.provider, 'eth_call', [{ to: normalizeAddress(to), data }, 'latest']);
  }

  async function readTokenInfo(tokenAddress) {
    const token = normalizeAddress(tokenAddress);
    const [nameResult, symbolResult, decimalsResult] = await Promise.allSettled([
      ethCall(token, '0x06fdde03'),
      ethCall(token, '0x95d89b41'),
      ethCall(token, '0x313ce567')
    ]);

    if (decimalsResult.status !== 'fulfilled' || !decimalsResult.value || decimalsResult.value === '0x') {
      throw new Error('Invalid ERC-20 token contract.');
    }

    const decimals = Number(BigInt(decimalsResult.value));
    const balanceRaw = state.address
      ? await ethCall(token, `0x70a08231${padAddress(state.address)}`).catch(() => '0x0')
      : '0x0';

    return {
      address: token,
      name: nameResult.status === 'fulfilled' ? decodeAbiString(nameResult.value) || 'Unknown Token' : 'Unknown Token',
      symbol: symbolResult.status === 'fulfilled' ? decodeAbiString(symbolResult.value) || 'TOKEN' : 'TOKEN',
      decimals,
      balanceRaw: BigInt(balanceRaw || '0x0').toString(),
      balance: formatUnits(BigInt(balanceRaw || '0x0'), decimals, 6)
    };
  }

  async function estimateGas(transaction) {
    if (!state.provider || !state.address) {
      throw new Error('Connect wallet before estimating gas.');
    }

    return request(state.provider, 'eth_estimateGas', [{
      from: state.address,
      to: normalizeAddress(transaction.to),
      data: transaction.data || '0x',
      value: transaction.value || '0x0'
    }]);
  }

  async function sendTransaction(transaction) {
    if (!state.provider || !state.address) {
      throw new Error('Connect wallet before sending a transaction.');
    }

    return request(state.provider, 'eth_sendTransaction', [{
      from: state.address,
      to: normalizeAddress(transaction.to),
      data: transaction.data || '0x',
      value: transaction.value || '0x0'
    }]);
  }

  async function requestTokenApproval(tokenAddress, spenderAddress, amountRaw) {
    const token = normalizeAddress(tokenAddress);
    const spender = normalizeAddress(spenderAddress);
    const amount = BigInt(amountRaw);
    const data = `0x095ea7b3${padAddress(spender)}${padUint256(amount)}`;

    return sendTransaction({
      to: token,
      data,
      value: '0x0'
    });
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    subscribers.add(callback);
    callback(snapshot());

    return () => {
      subscribers.delete(callback);
    };
  }

  function init(options = {}) {
    config = { ...config, ...options };

    if (state.initialized) {
      emit();
      return restorePromise || Promise.resolve(snapshot());
    }

    state.initialized = true;
    emit();
    discoverWallets();

    if (config.autoRestore) {
      return restoreConnection();
    }

    return Promise.resolve(snapshot());
  }

  global.B20Wallet = {
    init,
    subscribe,
    getState: snapshot,
    discoverWallets,
    restoreConnection,
    connect,
    disconnect,
    signMessage,
    switchToBase,
    readTokenInfo,
    estimateGas,
    sendTransaction,
    requestTokenApproval,
    isAddress,
    normalizeAddress,
    parseUnits,
    formatUnits,
    shortAddress,
    networkName
  };

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
})(window);
