(function () {
  const accessPassword = '0xb20.lol';
  const accessGateEnabled = false;
  const walletConnectProjectId = '917508eb683075298f4c297df0bf21d1';

  const selectors = {
    launch: '[data-test-launch]',
    console: '[data-test-console]',
    walletList: '[data-wallet-list]',
    connect: '[data-connect-wallet]',
    disconnect: '[data-disconnect-wallet]',
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
    selectedProviderId: ''
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

  function resetSignature() {
    const resultTarget = query(selectors.signatureResult);
    const signButton = query(selectors.sign);

    setText(query(selectors.signatureMessage), createSignatureMessage());
    setText(resultTarget, 'Identity verification has not started.');
    resultTarget.classList.remove('is-verified');

    if (signButton) {
      signButton.disabled = true;
    }
  }

  function renderAvatar(walletState) {
    const target = query(selectors.walletAvatar);

    if (!target) {
      return;
    }

    target.replaceChildren();

    if (walletState.profile && walletState.profile.avatar) {
      const image = document.createElement('img');
      image.src = walletState.profile.avatar;
      image.alt = 'Wallet profile avatar';
      image.loading = 'lazy';
      target.append(image);
      return;
    }

    target.textContent = walletState.address ? walletState.address.slice(2, 4).toUpperCase() : '?';
  }

  function renderWalletList(walletState) {
    const target = query(selectors.walletList);

    if (!target) {
      return;
    }

    const providers = walletState.providers || [];

    if (!providers.length) {
      target.innerHTML = '<p class="test-muted">No wallet provider detected. Install MetaMask, Coinbase Wallet, Rabby, Rainbow, or use WalletConnect.</p>';
      return;
    }

    if (!state.selectedProviderId) {
      state.selectedProviderId = walletState.selectedProviderId
        || (providers.find((provider) => !provider.disabled) || providers[0]).id;
    }

    target.replaceChildren(...providers.map((wallet) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `test-wallet-option${state.selectedProviderId === wallet.id ? ' is-selected' : ''}`;
      button.disabled = Boolean(wallet.disabled);

      const title = document.createElement('strong');
      title.textContent = wallet.name;

      const meta = document.createElement('span');
      meta.textContent = wallet.disabled ? 'adapter unavailable' : wallet.type;

      button.append(title, meta);
      button.addEventListener('click', () => {
        state.selectedProviderId = wallet.id;
        renderWalletList(window.B20Wallet.getState());
      });

      return button;
    }));
  }

  function renderWalletState(walletState) {
    setText(query(selectors.walletStatus), walletState.status === 'CONNECTED' ? 'CONNECTED' : walletState.status);
    setText(query(selectors.walletMessage), walletState.message || 'Wallet laboratory idle.');
    setField('status', walletState.connected ? 'CONNECTED' : 'Disconnected');
    setField('wallet', walletState.walletName || 'Unknown');
    setField('address', walletState.address || 'Not connected');
    setField('shortAddress', walletState.shortAddress || '--');
    setField('baseName', walletState.profile && walletState.profile.baseName ? walletState.profile.baseName : 'Not detected');
    setField('ens', walletState.profile && walletState.profile.ens ? walletState.profile.ens : 'Not detected');
    setField('network', walletState.connected ? walletState.network : 'Unknown');
    setField('balance', walletState.connected ? walletState.balance : 'Unknown');
    setField('access', walletState.connected ? walletState.isBase ? 'GRANTED' : 'GRANTED / BASE RECOMMENDED' : 'Pending');
    renderAvatar(walletState);
    renderWalletList(walletState);

    const signButton = query(selectors.sign);
    const disconnectButton = query(selectors.disconnect);

    if (signButton) {
      signButton.disabled = !walletState.connected;
    }

    if (disconnectButton) {
      disconnectButton.disabled = !walletState.connected;
    }
  }

  async function connectWallet() {
    try {
      await window.B20Wallet.connect(state.selectedProviderId);
    } catch (error) {
      setText(query(selectors.walletMessage), error && error.message ? error.message : 'Wallet connection rejected.');
    }
  }

  async function signMessage() {
    const message = createSignatureMessage();
    const messageTarget = query(selectors.signatureMessage);
    const resultTarget = query(selectors.signatureResult);

    setText(messageTarget, message);
    setText(resultTarget, 'Awaiting wallet signature...');
    resultTarget.classList.remove('is-verified');

    try {
      const signature = await window.B20Wallet.signMessage(message);

      resultTarget.classList.add('is-verified');
      setText(resultTarget, [
        'Identity Verified',
        'Researcher Authenticated',
        '',
        `Signature: ${window.B20Wallet.shortAddress(signature)}`
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

    window.B20Wallet.discoverWallets();
  }

  function bindEvents() {
    query(selectors.launch).addEventListener('click', launchModule);
    query(selectors.refreshWallets).addEventListener('click', () => window.B20Wallet.discoverWallets());
    query(selectors.connect).addEventListener('click', connectWallet);
    query(selectors.sign).addEventListener('click', signMessage);
    query(selectors.disconnect).addEventListener('click', () => window.B20Wallet.disconnect());
  }

  function initTestLab() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    resetSignature();
    bindEvents();

    window.B20Wallet.init({
      walletConnectProjectId,
      appName: '0XB20 Laboratory Test',
      appDescription: 'Read-only wallet integration sandbox.',
      appUrl: 'https://0xb20.lol/test'
    });
    window.B20Wallet.subscribe(renderWalletState);

    if (window.B20Interactions) {
      window.B20Interactions.initReactivePanels();
    }
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
