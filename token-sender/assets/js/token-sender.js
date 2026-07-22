(function () {
  const accessPassword = '0xb20.lol';
  const accessGateEnabled = false;
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
    defaultAmount: '[data-default-amount]',
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
    executionMessage: '[data-token-execution-message]',
    executionDetails: '[data-token-execution-details]'
  };

  const state = {
    initialized: false,
    selectedProviderId: '',
    wallet: null,
    config: fallbackConfig,
    token: null,
    preview: null,
    approvalTx: '',
    batchTx: ''
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

  async function requireSenderBytecode() {
    if (!hasSenderContract()) {
      throw new Error('Distribution contract is not configured.');
    }

    const code = await window.B20Wallet.readContractCode(senderConfig().contractAddress);
    const normalizedCode = String(code || '').toLowerCase();

    if (!normalizedCode || normalizedCode === '0x') {
      throw new Error('Configured sender address has no contract code on Base. Deploy the sender contract and update configuration.');
    }

    if (!normalizedCode.includes('f8129cd2') || !normalizedCode.includes('23b872dd')) {
      throw new Error('Configured sender contract does not match the expected Token Sender interface.');
    }

    return code;
  }

  async function getSenderReadiness() {
    if (!hasSenderContract()) {
      return {
        ready: false,
        message: 'Distribution contract is not configured. Preview mode only.'
      };
    }

    try {
      await requireSenderBytecode();

      return {
        ready: true,
        message: 'Sender contract verified on Base.'
      };
    } catch (error) {
      return {
        ready: false,
        message: error && error.message ? error.message : 'Sender contract verification failed.'
      };
    }
  }

  function basescanAddressUrl(address) {
    return `https://basescan.org/address/${address}`;
  }

  function basescanTxUrl(transactionHash) {
    return `https://basescan.org/tx/${transactionHash}`;
  }

  function createDetailRow(label, value, href) {
    const row = document.createElement('div');
    row.className = 'sender-detail-row';

    const labelNode = document.createElement('span');
    labelNode.textContent = label;

    const valueNode = href ? document.createElement('a') : document.createElement('code');
    valueNode.textContent = value;

    if (href) {
      valueNode.href = href;
      valueNode.target = '_blank';
      valueNode.rel = 'noopener noreferrer';
    }

    row.append(labelNode, valueNode);
    return row;
  }

  function stripHexPrefix(value) {
    return String(value || '').replace(/^0x/i, '');
  }

  function padHex(value, length) {
    return stripHexPrefix(value).padStart(length, '0');
  }

  function padAddress(address) {
    return padHex(window.B20Wallet.normalizeAddress(address), 64);
  }

  function padUint256(value) {
    return BigInt(value).toString(16).padStart(64, '0');
  }

  function encodeAddressArray(addresses) {
    return [
      padUint256(addresses.length),
      ...addresses.map(padAddress)
    ].join('');
  }

  function encodeUintArray(values) {
    return [
      padUint256(values.length),
      ...values.map(padUint256)
    ].join('');
  }

  function buildSenderTransaction() {
    if (!state.preview || !state.token || !hasSenderContract()) {
      throw new Error('Validated preview and sender contract are required.');
    }

    const recipients = state.preview.recipients.map((recipient) => recipient.address);
    const amounts = state.preview.recipients.map((recipient) => recipient.amountRaw);
    const recipientsSegment = encodeAddressArray(recipients);
    const amountsSegment = encodeUintArray(amounts);
    const headSize = 3n * 32n;
    const amountsOffset = headSize + BigInt(recipientsSegment.length / 2);

    return {
      to: senderConfig().contractAddress,
      value: '0x0',
      data: [
        '0xf8129cd2',
        padAddress(state.token.address),
        padUint256(headSize),
        padUint256(amountsOffset),
        recipientsSegment,
        amountsSegment
      ].join('')
    };
  }

  function renderContractStatus() {
    const target = query(selectors.contractStatus);
    const config = senderConfig();

    if (!target) {
      return;
    }

    target.replaceChildren();

    if (!hasSenderContract()) {
      target.textContent = 'Distribution contract not configured. Preview mode is active.';
      renderExecutionDetails();
      return;
    }

    const title = document.createElement('p');
    title.textContent = `${config.contractName} ready on ${config.network}. Exact approval mode active.`;

    const note = document.createElement('p');
    note.textContent = 'Step 1 approves only the exact preview amount. Step 2 sends the batch. Approval alone does not transfer tokens.';

    target.append(
      title,
      note,
      createDetailRow('Sender Contract', config.contractAddress, basescanAddressUrl(config.contractAddress))
    );
    renderExecutionDetails();
  }

  function renderExecutionDetails() {
    const target = query(selectors.executionDetails);

    if (!target) {
      return;
    }

    const rows = [];

    if (state.token) {
      rows.push(createDetailRow('Token Contract', state.token.address, basescanAddressUrl(state.token.address)));
    }

    if (state.preview) {
      rows.push(createDetailRow('Transfer Total', `${state.preview.totalFormatted} ${state.token ? state.token.symbol : 'TOKEN'}`));
      rows.push(createDetailRow('Sender Status', state.preview.senderMessage || 'Unknown'));
      rows.push(createDetailRow('Allowance Status', state.preview.allowanceReady ? 'READY FOR SEND' : 'APPROVAL REQUIRED'));
    }

    if (state.approvalTx) {
      rows.push(createDetailRow('Approval TX', state.approvalTx, basescanTxUrl(state.approvalTx)));
    }

    if (state.batchTx) {
      rows.push(createDetailRow('Batch TX', state.batchTx, basescanTxUrl(state.batchTx)));
    }

    target.replaceChildren(...rows);
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
    const defaultAmount = query(selectors.defaultAmount).value.trim();
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

      const parts = trimmed.includes(',')
        ? trimmed.split(',').map((part) => part.trim())
        : [trimmed, defaultAmount];

      if (parts.length !== 2 || !parts[1]) {
        errors.push(`Line ${index + 1}: add an amount or fill Amount Per Wallet.`);
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
    const hasAllowance = Boolean(state.preview && state.preview.allowanceReady);
    const senderReady = Boolean(state.preview && state.preview.senderReady);

    if (approveButton) {
      approveButton.disabled = !canPreview || !connectedToBase || !contractReady || !senderReady || hasAllowance;
    }

    if (sendButton) {
      sendButton.disabled = !canPreview || !connectedToBase || !contractReady || !senderReady || !hasAllowance;
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
      state.batchTx = '';
      renderTokenReadout();
      renderPreview();
      renderExecutionDetails();
      showErrors([]);
      setText(query(selectors.executionMessage), 'Token specimen loaded. Recipient validation can begin.');
    } catch (error) {
      state.token = null;
      state.preview = null;
      state.approvalTx = '';
      state.batchTx = '';
      renderTokenReadout();
      renderPreview();
      renderExecutionDetails();
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
        renderExecutionDetails();
        updateExecutionState();
        return;
      }

      if (state.token.balanceRaw && parsed.totalRaw > BigInt(state.token.balanceRaw)) {
        state.preview = null;
        showErrors([`Insufficient wallet balance. Required ${parsed.totalFormatted} ${state.token.symbol}, available ${state.token.balance} ${state.token.symbol}.`]);
        renderPreview();
        renderExecutionDetails();
        updateExecutionState();
        return;
      }

      showErrors([]);
      const preview = {
        recipients: parsed.recipients,
        totalRaw: parsed.totalRaw.toString(),
        totalFormatted: parsed.totalFormatted,
        allowanceReady: false,
        senderReady: false,
        senderMessage: '',
        estimatedGas: hasSenderContract()
          ? 'Checking allowance...'
          : 'Unavailable until sender contract is configured'
      };

      const senderStatus = await getSenderReadiness();
      preview.senderReady = senderStatus.ready;
      preview.senderMessage = senderStatus.message;

      if (senderStatus.ready) {
        const allowanceRaw = await window.B20Wallet.readTokenAllowance(
          state.token.address,
          state.wallet.address,
          senderConfig().contractAddress
        );
        preview.allowanceRaw = allowanceRaw;
        preview.allowanceReady = BigInt(allowanceRaw) >= parsed.totalRaw;

        if (preview.allowanceReady) {
          try {
            const gas = await window.B20Wallet.estimateGas({
              to: senderConfig().contractAddress,
              data: buildSenderTransactionFromPreview(preview),
              value: '0x0'
            });
            preview.estimatedGas = BigInt(gas).toString();
          } catch (error) {
            preview.estimatedGas = 'Gas estimate unavailable';
          }
        } else {
          preview.estimatedGas = 'Available after exact approval';
        }
      } else {
        preview.estimatedGas = senderStatus.message;
      }

      state.preview = preview;
      state.approvalTx = '';
      state.batchTx = '';
      renderPreview();
      renderExecutionDetails();
      updateExecutionState();
      setText(
        query(selectors.executionMessage),
        preview.senderReady
          ? 'Preview validated. No transaction has been requested.'
          : `Preview validated. ${preview.senderMessage}`
      );
    } catch (error) {
      state.preview = null;
      renderPreview();
      renderExecutionDetails();
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

      await requireSenderBytecode();

      const txHash = await window.B20Wallet.requestTokenApproval(
        state.token.address,
        senderConfig().contractAddress,
        state.preview.totalRaw
      );

      state.approvalTx = txHash;
      renderExecutionDetails();
      setText(query(selectors.executionMessage), `Approval submitted. Full hash: ${txHash}. Waiting for confirmation...`);

      const receipt = await window.B20Wallet.waitForTransactionReceipt(txHash);

      if (receipt.status && receipt.status !== '0x1') {
        throw new Error('Approval transaction failed.');
      }

      state.preview.allowanceReady = true;
      updateExecutionState();
      renderExecutionDetails();
      setText(query(selectors.executionMessage), `Exact approval confirmed. Now press Send Batch to move tokens.`);
    } catch (error) {
      setText(query(selectors.executionMessage), error && error.message ? error.message : 'Approval rejected.');
    }
  }

  function buildSenderTransactionFromPreview(preview) {
    const currentPreview = state.preview;
    state.preview = preview;

    try {
      return buildSenderTransaction().data;
    } finally {
      state.preview = currentPreview;
    }
  }

  async function sendBatch() {
    try {
      if (!state.preview || !state.token) {
        throw new Error('Validate preview before sending.');
      }

      if (!hasSenderContract()) {
        throw new Error('Distribution contract is not configured.');
      }

      await requireSenderBytecode();

      if (!state.preview.allowanceReady) {
        throw new Error('Approve exact amount before sending.');
      }

      const transaction = buildSenderTransaction();
      setText(query(selectors.executionMessage), 'Awaiting wallet confirmation for batch send...');
      const txHash = await window.B20Wallet.sendTransaction(transaction);
      state.batchTx = txHash;
      renderExecutionDetails();
      setText(query(selectors.executionMessage), `Batch submitted. Full hash: ${txHash}. Waiting for confirmation...`);
      const receipt = await window.B20Wallet.waitForTransactionReceipt(txHash);

      if (receipt.status && receipt.status !== '0x1') {
        throw new Error('Batch transaction failed.');
      }

      state.preview.allowanceReady = false;
      state.approvalTx = '';
      updateExecutionState();
      renderExecutionDetails();
      setText(query(selectors.executionMessage), `Batch confirmed. Tokens were sent. Full hash: ${txHash}.`);
    } catch (error) {
      setText(query(selectors.executionMessage), error && error.message ? error.message : 'Batch send rejected.');
    }
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
    query(selectors.tokenAddress).addEventListener('input', () => {
      state.token = null;
      state.preview = null;
      state.approvalTx = '';
      state.batchTx = '';
      renderTokenReadout();
      renderPreview();
      renderExecutionDetails();
      updateExecutionState();
    });
    query(selectors.preview).addEventListener('click', validatePreview);
    query(selectors.defaultAmount).addEventListener('input', () => {
      state.preview = null;
      state.approvalTx = '';
      state.batchTx = '';
      renderPreview();
      renderExecutionDetails();
      updateExecutionState();
    });
    query(selectors.recipients).addEventListener('input', () => {
      state.preview = null;
      state.approvalTx = '';
      state.batchTx = '';
      showErrors([]);
      renderPreview();
      renderExecutionDetails();
      updateExecutionState();
    });
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
