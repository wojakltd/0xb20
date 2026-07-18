(function () {
  const accessPassword = '0xb20.lol';
  const accessGateEnabled = true;
  const walletConnectProjectId = '';
  const baseChainId = '0x2105';
  const chainNames = {
    '0x1': 'ETHEREUM',
    '0x2105': 'BASE',
    '0xa': 'OPTIMISM',
    '0xa4b1': 'ARBITRUM',
    '0x89': 'POLYGON',
    '0xaa36a7': 'SEPOLIA',
    '0x14a34': 'BASE SEPOLIA'
  };

  const selectors = {
    launch: '[data-test-launch]',
    console: '[data-test-console]',
    walletList: '[data-wallet-list]',
    connect: '[data-connect-wallet]',
    refreshWallets: '[data-refresh-wallets]',
    sign: '[data-sign-message]',
    walletStatus: '[data-wallet-status]',
    walletMessage: '[data-wallet-message]',
    walletAvatar: '[data-wallet-avatar]',
    signatureMessage: '[data-signature-message]',
    signatureResult: '[data-signature-result]'
  };

  const state = {
    initialized: false,
    launched: false,
    discoveryListening: false,
    providers: [],
    selectedProviderId: '',
    provider: null,
    walletName: '',
    address: '',
    chainId: '',
    profile: null,
    lastSignatureMessage: ''
  };

  function query(selector) {
    return document.querySelector(selector);
  }

  function field(name) {
    return document.querySelector(`[data-wallet-field="${name}"]`);
  }

  function setText(target, value) {
    if (target) {
      target.textContent = value;
    }
  }

  function setField(name, value) {
    setText(field(name), value || 'Unknown');
  }

  function shortAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';
  }

  function networkName(chainId) {
    return chainNames[String(chainId || '').toLowerCase()] || `UNKNOWN (${chainId || '--'})`;
  }

  function formatEthBalance(hexBalance) {
    try {
      const wei = BigInt(hexBalance || '0x0');
      const ether = wei / 1000000000000000000n;
      const remainder = wei % 1000000000000000000n;
      const decimals = remainder.toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '');
      return `${ether.toString()}${decimals ? `.${decimals}` : ''} ETH`;
    } catch (error) {
      return 'Unavailable';
    }
  }

  function randomNonce() {
    const values = new Uint32Array(2);
    window.crypto.getRandomValues(values);
    return Array.from(values).map((value) => value.toString(16).padStart(8, '0')).join('');
  }

  function createSignatureMessage() {
    return [
      'Welcome to 0XB20 Laboratory',
      '',
      `Nonce: ${randomNonce()}`,
      `Timestamp: ${new Date().toISOString()}`
    ].join('\n');
  }

  function setStatus(value) {
    setText(query(selectors.walletStatus), value);
  }

  function setMessage(value) {
    setText(query(selectors.walletMessage), value);
  }

  function resetWalletFields() {
    setStatus('STANDBY');
    setField('status', 'Disconnected');
    setField('wallet', 'Unknown');
    setField('address', 'Not connected');
    setField('shortAddress', '--');
    setField('baseName', 'Not detected');
    setField('ens', 'Not detected');
    setField('network', 'Unknown');
    setField('balance', 'Unknown');
    setField('access', 'Pending');
    setText(query(selectors.walletAvatar), '?');
    query(selectors.sign).disabled = true;
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
      type: 'injected'
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
      disabled: !walletConnectProjectId
    });
  }

  function handleProviderAnnouncement(event) {
    const detail = event.detail || {};
    addProvider(detail.provider, detail.info || {});
    renderWalletList();
  }

  function renderWalletList() {
    const target = query(selectors.walletList);

    if (!target) {
      return;
    }

    if (!state.providers.length) {
      target.innerHTML = '<p class="test-muted">No wallet provider detected. Install MetaMask, Coinbase Wallet, Rabby, Rainbow, or configure WalletConnect.</p>';
      return;
    }

    target.replaceChildren(...state.providers.map((wallet) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `test-wallet-option${state.selectedProviderId === wallet.id ? ' is-selected' : ''}`;
      button.disabled = Boolean(wallet.disabled);
      button.innerHTML = `<strong>${wallet.name}</strong><span>${wallet.disabled ? 'adapter ready' : wallet.type}</span>`;
      button.addEventListener('click', () => {
        state.selectedProviderId = wallet.id;
        renderWalletList();
      });
      return button;
    }));

    if (!state.selectedProviderId) {
      const firstEnabled = state.providers.find((provider) => !provider.disabled);
      state.selectedProviderId = firstEnabled ? firstEnabled.id : '';
      renderWalletList();
    }
  }

  function discoverLegacyProviders() {
    const ethereum = window.ethereum;

    if (!ethereum) {
      return;
    }

    if (Array.isArray(ethereum.providers)) {
      ethereum.providers.forEach((provider) => addProvider(provider));
      return;
    }

    addProvider(ethereum);
  }

  function discoverWallets() {
    state.providers = [];
    state.selectedProviderId = '';

    if (!state.discoveryListening) {
      window.addEventListener('eip6963:announceProvider', handleProviderAnnouncement);
      state.discoveryListening = true;
    }

    window.dispatchEvent(new Event('eip6963:requestProvider'));

    window.setTimeout(() => {
      discoverLegacyProviders();
      addWalletConnectAdapter();
      renderWalletList();
    }, 350);
  }

  async function createWalletConnectProvider() {
    if (!walletConnectProjectId) {
      throw new Error('WalletConnect project id is not configured for this sandbox.');
    }

    const walletConnectModule = await import('https://esm.sh/@walletconnect/ethereum-provider@2');
    const provider = await walletConnectModule.default.init({
      projectId: walletConnectProjectId,
      chains: [8453],
      optionalChains: [1],
      showQrModal: true,
      metadata: {
        name: '0XB20 Laboratory Test',
        description: 'Read-only wallet integration sandbox.',
        url: 'https://0xb20.lol/test',
        icons: ['https://0xb20.lol/favicon.png']
      }
    });

    await provider.connect();
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
      const profiles = Array.isArray(payload) ? payload : Array.isArray(payload.profiles) ? payload.profiles : [];
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

  async function readWalletState(provider, walletName) {
    setStatus('SCANNING');
    setMessage('SCANNING SPECIMEN...');

    const [accounts, chainId] = await Promise.all([
      provider.request({ method: 'eth_accounts' }),
      provider.request({ method: 'eth_chainId' })
    ]);
    const address = accounts && accounts[0] ? accounts[0] : '';

    if (!address) {
      throw new Error('Wallet returned no address.');
    }

    const balance = await provider.request({
      method: 'eth_getBalance',
      params: [address, 'latest']
    });
    const profile = await resolveProfile(address);

    state.address = address;
    state.chainId = chainId;
    state.profile = profile;

    setStatus('CONNECTED');
    setField('status', 'CONNECTED');
    setField('wallet', walletName);
    setField('address', address);
    setField('shortAddress', shortAddress(address));
    setField('baseName', profile && profile.baseName ? profile.baseName : 'Not detected');
    setField('ens', profile && profile.ens ? profile.ens : 'Not detected');
    setField('network', networkName(chainId));
    setField('balance', formatEthBalance(balance));
    setField('access', chainId === baseChainId ? 'GRANTED' : 'GRANTED / BASE RECOMMENDED');
    setMessage('Identity confirmed. Read-only specimen scan complete.');
    query(selectors.sign).disabled = false;
    renderAvatar(address, profile);
  }

  function renderAvatar(address, profile) {
    const target = query(selectors.walletAvatar);

    if (!target) {
      return;
    }

    target.replaceChildren();

    if (profile && profile.avatar) {
      const image = document.createElement('img');
      image.src = profile.avatar;
      image.alt = 'Wallet profile avatar';
      image.loading = 'lazy';
      target.append(image);
      return;
    }

    target.textContent = address ? address.slice(2, 4).toUpperCase() : '?';
  }

  function attachProviderEvents(provider) {
    if (!provider || typeof provider.on !== 'function') {
      return;
    }

    provider.on('accountsChanged', (accounts) => {
      if (!accounts || !accounts[0]) {
        resetWalletFields();
        setMessage('Wallet disconnected.');
        return;
      }

      readWalletState(provider, state.walletName).catch((error) => setMessage(error.message));
    });

    provider.on('chainChanged', () => {
      readWalletState(provider, state.walletName).catch((error) => setMessage(error.message));
    });
  }

  async function connectWallet() {
    try {
      const selected = state.providers.find((provider) => provider.id === state.selectedProviderId)
        || state.providers.find((provider) => !provider.disabled);

      if (!selected) {
        setMessage('No compatible wallet detected.');
        return;
      }

      setStatus('CONNECTING');
      setMessage(`Connecting ${selected.name}...`);

      const provider = selected.type === 'walletconnect'
        ? await createWalletConnectProvider()
        : selected.provider;

      await provider.request({ method: 'eth_requestAccounts' });

      state.provider = provider;
      state.walletName = selected.name;
      attachProviderEvents(provider);
      await readWalletState(provider, selected.name);
    } catch (error) {
      setStatus('ERROR');
      setMessage(error && error.message ? error.message : 'Wallet connection rejected.');
    }
  }

  async function signMessage() {
    if (!state.provider || !state.address) {
      return;
    }

    const message = createSignatureMessage();
    const messageTarget = query(selectors.signatureMessage);
    const resultTarget = query(selectors.signatureResult);

    state.lastSignatureMessage = message;
    setText(messageTarget, message);
    setText(resultTarget, 'Awaiting wallet signature...');
    resultTarget.classList.remove('is-verified');

    try {
      const signature = await state.provider.request({
        method: 'personal_sign',
        params: [message, state.address]
      });

      resultTarget.classList.add('is-verified');
      setText(resultTarget, [
        'Identity Verified',
        'Researcher Authenticated',
        '',
        `Signature: ${shortAddress(signature)}`
      ].join('\n'));
    } catch (error) {
      setText(resultTarget, error && error.message ? error.message : 'Signature rejected.');
    }
  }

  function launchModule() {
    const consoleTarget = query(selectors.console);

    state.launched = true;

    if (consoleTarget) {
      consoleTarget.hidden = false;
      consoleTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    discoverWallets();
  }

  function bindEvents() {
    query(selectors.launch).addEventListener('click', launchModule);
    query(selectors.refreshWallets).addEventListener('click', discoverWallets);
    query(selectors.connect).addEventListener('click', connectWallet);
    query(selectors.sign).addEventListener('click', signMessage);
  }

  function initTestLab() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    resetWalletFields();
    bindEvents();
    setText(query(selectors.signatureMessage), createSignatureMessage());
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.B20AccessGate) {
      initTestLab();
      return;
    }

    window.B20AccessGate.init({
      enabled: accessGateEnabled,
      password: accessPassword,
      storageKey: 'b20-test-lab-access',
      gateSelector: '[data-test-gate]',
      contentSelector: '[data-test-content]',
      formSelector: '[data-test-gate-form]',
      inputSelector: '[data-test-password]',
      errorSelector: '[data-test-gate-error]',
      onUnlock: initTestLab
    });
  });
})();
