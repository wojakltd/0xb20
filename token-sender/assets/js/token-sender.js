(function () {
  const accessPassword = '0xb20.lol';
  const accessGateEnabled = true;
  const fallbackConfig = {
    wallet: {
      walletConnectProjectId: '917508eb683075298f4c297df0bf21d1',
      defaultChainId: '0x2105',
      defaultNetwork: 'BASE'
    },
    tokenSender: {
      enabled: true,
      chainId: '0x2105',
      network: 'BASE',
      contractAddress: '',
      contractName: '0XB20 Token Sender',
      approvalMode: 'exact',
      maxRecipients: 250
    }
  };

  const selectors = {
    walletList: '[data-token-wallet-list]',
    walletStatus: '[data-token-wallet-status]',
    walletMessage: '[data-token-wallet-message]',
    connect: '[data-token-connect]',
    disconnect: '[data-token-disconnect]',
    switchBase: '[data-token-switch-base]',
    tokenAddress: '[data-token-address]',
    loadToken: '[data-token-load]',
    tokenReadout: '[data-token-readout]',
    recipients: '[data-recipient-list]',
    recipientErrors: '[data-recipient-errors]',
    preview: '[data-token-preview]',
    previewState: '[data-token-preview-state]',
    previewWallets: '[data-preview-wallets]',
    previewTotal: '[data-preview-total]',
    previewGas: '[data-preview-gas]',
    previewTable: '[data-preview-table]',
    contractStatus: '[data-contract-status]',
    approve: '[data-token-approve]',
    send: '[data-token-send]',
    executionMessage: '[data-token-execution-message]'
  };

  const state = {
    initialized: false,
    selectedProviderId: '',
    wallet: null,
    config: fallbackConfig,
    token: null,
    preview: null,
    approvalTx: ''
  };

  function query(selector) {
    return document.querySelector(selector);
  }

  function walletField(name) {
    return document.querySelector(`[data-token-wallet-field="${name}"]`);
  }

  function setText(target, value) {
    if (target) {
      target.textContent = value;
    }
  }

  function setWalletField(name, value) {
    setText(walletField(name), value || 'Unknown');
  }

  async function loadConfig() {
    try {
      const response = await fetch('/data/web3-tools.json', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Web3 config unavailable.');
      }

      state.config = await response.json();
    } catch (error) {
      state.config = fallbackConfig;
    }

    renderContractStatus();
  }

  function senderConfig() {
    return state.config.tokenSender || fallbackConfig.tokenSender;
  }

  function walletConfig() {
    return state.config.wallet || fallbackConfig.wallet;
  }

  function hasSenderContract() {
    const config = senderConfig();
    return Boolean(config.contractAddress && window.B20Wallet.isAddress(config.contractAddress));
  }

  function renderContractStatus() {
    const target = query(selectors.contractStatus);
    const config = senderConfig();

    if (!target) {
      return;
    }

    if (hasSenderContract()) {
      target.textContent = `${config.contractName} ready on ${config.network}. Exact approval mode active.`;
      return;
    }

    target.textContent = 'Distribution contract not configured. Preview mode is active.';
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

  function renderWallet(walletState) {
    state.wallet = walletState;
    setText(query(selectors.walletStatus), walletState.connected ? 'CONNECTED' : walletState.status);
    setText(query(selectors.walletMessage), walletState.message || 'Global wallet layer idle.');
    setWalletField('status', walletState.connected ? 'CONNECTED' : 'Disconnected');
    setWalletField('address', walletState.address || 'Not connected');
    setWalletField('network', walletState.connected ? walletState.network : 'Unknown');
    setWalletField('balance', walletState.connected ? walletState.balance : 'Unknown');
    renderWalletList(walletState);

    query(selectors.disconnect).disabled = !walletState.connected;
    query(selectors.switchBase).hidden = !walletState.connected || walletState.isBase;
    updateExecutionState();
  }

  function renderTokenReadout() {
    const target = query(selectors.tokenReadout);

    if (!target) {
      return;
    }

    const values = state.token
      ? [
          `Name: ${state.token.name}`,
          `Symbol: ${state.token.symbol}`,
          `Decimals: ${state.token.decimals}`,
          `Wallet Balance: ${state.token.balance} ${state.token.symbol}`
        ]
      : ['Name: --', 'Symbol: --', 'Decimals: --', 'Wallet Balance: --'];

    target.replaceChildren(...values.map((value) => {
      const item = document.createElement('span');
      item.textContent = value;
      return item;
    }));
  }

  function showErrors(errors) {
    const target = query(selectors.recipientErrors);

    if (!target) {
      return;
    }

    if (!errors.length) {
      target.hidden = true;
      target.textContent = '';
      return;
    }

    target.hidden = false;
    target.textContent = errors.join('\n');
  }

  function parseRecipients() {
    const errors = [];
    const recipients = [];
    const seen = new Set();
    const text = query(selectors.recipients).value || '';
    const lines = text.split(/\r?\n/);
    const decimals = state.token ? state.token.decimals : 18;
    const maxRecipients = senderConfig().maxRecipients || 250;
    let totalRaw = 0n;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      const parts = trimmed.split(',').map((part) => part.trim());

      if (parts.length !== 2) {
        errors.push(`Line ${index + 1}: use address,amount format.`);
        return;
      }

      const [addressInput, amountInput] = parts;

      try {
        const address = window.B20Wallet.normalizeAddress(addressInput);

        if (seen.has(address.toLowerCase())) {
          errors.push(`Line ${index + 1}: duplicate recipient.`);
          return;
        }

        const amountRaw = window.B20Wallet.parseUnits(amountInput, decimals);

        if (amountRaw <= 0n) {
          errors.push(`Line ${index + 1}: amount must be greater than zero.`);
          return;
        }

        seen.add(address.toLowerCase());
        totalRaw += amountRaw;
        recipients.push({
          address,
          amount: amountInput,
          amountRaw: amountRaw.toString()
        });
      } catch (error) {
        errors.push(`Line ${index + 1}: ${error && error.message ? error.message : 'invalid recipient.'}`);
      }
    });

    if (recipients.length > maxRecipients) {
      errors.push(`Too many recipients. Maximum is ${maxRecipients}.`);
    }

    if (!recipients.length && !errors.length) {
      errors.push('No recipients detected.');
    }

    return {
      errors,
      recipients,
      totalRaw,
      totalFormatted: state.token
        ? window.B20Wallet.formatUnits(totalRaw, state.token.decimals, 6)
        : totalRaw.toString()
    };
  }

  function renderPreview() {
    const preview = state.preview;
    const tokenSymbol = state.token ? state.token.symbol : 'TOKEN';

    setText(query(selectors.previewState), preview ? 'VALIDATED' : 'WAITING');
    setText(query(selectors.previewWallets), preview ? String(preview.recipients.length) : '0');
    setText(query(selectors.previewTotal), preview ? `${preview.totalFormatted} ${tokenSymbol}` : '0');
    setText(query(selectors.previewGas), preview ? preview.estimatedGas : 'Unavailable');

    const table = query(selectors.previewTable);

    if (!table) {
      return;
    }

    if (!preview) {
      table.innerHTML = '<p class="test-muted">No validated recipients yet.</p>';
      return;
    }

    table.replaceChildren(...preview.recipients.map((recipient) => {
      const row = document.createElement('div');
      row.className = 'sender-preview-row';

      const address = document.createElement('strong');
      address.textContent = recipient.address;

      const amount = document.createElement('span');
      amount.textContent = `${recipient.amount} ${tokenSymbol}`;

      row.append(address, amount);
      return row;
    }));
  }

  function updateExecutionState() {
    const approveButton = query(selectors.approve);
    const sendButton = query(selectors.send);
    const canPreview = Boolean(state.preview);
    const connectedToBase = Boolean(state.wallet && state.wallet.connected && state.wallet.isBase);
    const contractReady = hasSenderContract();

    if (approveButton) {
      approveButton.disabled = !canPreview || !connectedToBase || !contractReady;
    }

    if (sendButton) {
      sendButton.disabled = !canPreview || !connectedToBase || !contractReady || !state.approvalTx;
    }
  }

  async function loadToken() {
    const address = query(selectors.tokenAddress).value.trim();

    try {
      if (!state.wallet || !state.wallet.connected) {
        throw new Error('Connect wallet before reading token data.');
      }

      if (!state.wallet.isBase) {
        throw new Error('Switch to Base before reading token data.');
      }

      state.token = await window.B20Wallet.readTokenInfo(address);
      state.preview = null;
      state.approvalTx = '';
      renderTokenReadout();
      renderPreview();
      showErrors([]);
      setText(query(selectors.executionMessage), 'Token specimen loaded. Recipient validation can begin.');
    } catch (error) {
      state.token = null;
      state.preview = null;
      renderTokenReadout();
      renderPreview();
      setText(query(selectors.executionMessage), error && error.message ? error.message : 'Token read failed.');
    }
  }

  async function validatePreview() {
    try {
      if (!state.wallet || !state.wallet.connected) {
        throw new Error('Connect wallet before preview.');
      }

      if (!state.wallet.isBase) {
        throw new Error('Switch to Base before preview.');
      }

      if (!state.token) {
        throw new Error('Read token contract before preview.');
      }

      const parsed = parseRecipients();

      if (parsed.errors.length) {
        state.preview = null;
        showErrors(parsed.errors);
        renderPreview();
        updateExecutionState();
        return;
      }

      showErrors([]);
      state.preview = {
        recipients: parsed.recipients,
        totalRaw: parsed.totalRaw.toString(),
        totalFormatted: parsed.totalFormatted,
        estimatedGas: hasSenderContract()
          ? 'Ready for contract estimate'
          : 'Unavailable until sender contract is configured'
      };
      state.approvalTx = '';
      renderPreview();
      updateExecutionState();
      setText(query(selectors.executionMessage), 'Preview validated. No transaction has been requested.');
    } catch (error) {
      state.preview = null;
      renderPreview();
      updateExecutionState();
      setText(query(selectors.executionMessage), error && error.message ? error.message : 'Preview failed.');
    }
  }

  async function approveExactAmount() {
    try {
      if (!state.preview || !state.token) {
        throw new Error('Validate preview before approval.');
      }

      if (!hasSenderContract()) {
        throw new Error('Distribution contract is not configured.');
      }

      const txHash = await window.B20Wallet.requestTokenApproval(
        state.token.address,
        senderConfig().contractAddress,
        state.preview.totalRaw
      );

      state.approvalTx = txHash;
      updateExecutionState();
      setText(query(selectors.executionMessage), `Exact approval submitted: ${window.B20Wallet.shortAddress(txHash)}`);
    } catch (error) {
      setText(query(selectors.executionMessage), error && error.message ? error.message : 'Approval rejected.');
    }
  }

  function sendBatch() {
    if (!hasSenderContract()) {
      setText(query(selectors.executionMessage), 'Distribution contract is not configured.');
      return;
    }

    setText(query(selectors.executionMessage), 'Send adapter is reserved for the audited Token Sender contract.');
  }

  function bindEvents() {
    query(selectors.connect).addEventListener('click', () => {
      window.B20Wallet.connect(state.selectedProviderId).catch((error) => {
        setText(query(selectors.walletMessage), error && error.message ? error.message : 'Wallet connection rejected.');
      });
    });
    query(selectors.disconnect).addEventListener('click', () => window.B20Wallet.disconnect());
    query(selectors.switchBase).addEventListener('click', () => {
      window.B20Wallet.switchToBase().catch((error) => {
        setText(query(selectors.walletMessage), error && error.message ? error.message : 'Network switch rejected.');
      });
    });
    query(selectors.loadToken).addEventListener('click', loadToken);
    query(selectors.preview).addEventListener('click', validatePreview);
    query(selectors.approve).addEventListener('click', approveExactAmount);
    query(selectors.send).addEventListener('click', sendBatch);
  }

  async function initTokenSender() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    await loadConfig();
    bindEvents();
    renderTokenReadout();
    renderPreview();

    window.B20Wallet.init({
      walletConnectProjectId: walletConfig().walletConnectProjectId,
      baseChainId: walletConfig().defaultChainId,
      appName: '0XB20 Token Sender',
      appDescription: 'Protected batch distribution instrument.',
      appUrl: 'https://0xb20.lol/token-sender'
    });
    window.B20Wallet.subscribe(renderWallet);

    if (window.B20Interactions) {
      window.B20Interactions.initReactivePanels();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.B20AccessGate) {
      initTokenSender();
      return;
    }

    window.B20AccessGate.init({
      enabled: accessGateEnabled,
      password: accessPassword,
      storageKey: 'b20-test-lab-access',
      gateSelector: '[data-token-gate]',
      contentSelector: '[data-token-content]',
      formSelector: '[data-token-gate-form]',
      inputSelector: '[data-token-password]',
      errorSelector: '[data-token-gate-error]',
      onUnlock: initTokenSender
    });
  });
})();
