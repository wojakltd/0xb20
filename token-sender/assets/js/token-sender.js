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
      maxRecipients: 250,
      safeBatchSize: 120
    }
  };

  const selectors = {
    walletList: '[data-token-wallet-list]',
    walletStatus: '[data-token-wallet-status]',
    walletMessage: '[data-token-wallet-message]',
    connect: '[data-token-connect]',
    disconnect: '[data-token-disconnect]',
    switchBase: '[data-token-switch-base]',
    premiumState: '[data-token-premium-state]',
    labPassStatus: '[data-token-lab-pass]',
    tokenAddress: '[data-token-address]',
    loadToken: '[data-token-load]',
    tokenReadout: '[data-token-readout]',
    defaultAmount: '[data-default-amount]',
    recipients: '[data-recipient-list]',
    recipientErrors: '[data-recipient-errors]',
    importFile: '[data-token-import-file]',
    importTxt: '[data-token-import-txt]',
    importCsv: '[data-token-import-csv]',
    importMessage: '[data-token-import-message]',
    bookName: '[data-token-book-name]',
    bookList: '[data-token-book-list]',
    bookSave: '[data-token-book-save]',
    bookLoad: '[data-token-book-load]',
    bookDuplicate: '[data-token-book-duplicate]',
    bookDelete: '[data-token-book-delete]',
    preview: '[data-token-preview]',
    previewState: '[data-token-preview-state]',
    previewWallets: '[data-preview-wallets]',
    previewTotal: '[data-preview-total]',
    previewGas: '[data-preview-gas]',
    previewBatches: '[data-preview-batches]',
    previewDuplicates: '[data-preview-duplicates]',
    previewInvalid: '[data-preview-invalid]',
    previewTable: '[data-preview-table]',
    contractStatus: '[data-contract-status]',
    approve: '[data-token-approve]',
    send: '[data-token-send]',
    retryFailed: '[data-token-retry-failed]',
    exportFailedTxt: '[data-token-export-failed-txt]',
    exportFailedCsv: '[data-token-export-failed-csv]',
    executionMessage: '[data-token-execution-message]',
    executionDetails: '[data-token-execution-details]',
    progress: '[data-token-progress]',
    history: '[data-token-history]',
    historyClear: '[data-token-history-clear]'
  };

  const state = {
    initialized: false,
    selectedProviderId: '',
    wallet: null,
    config: fallbackConfig,
    premium: null,
    token: null,
    preview: null,
    approvalTx: '',
    batchTx: '',
    sending: false,
    importMode: 'txt'
  };

  const modules = {
    core: () => window.B20SenderCore,
    storage: () => window.B20SenderStorage,
    importer: () => window.B20SenderImport,
    batcher: () => window.B20SenderBatcher,
    history: () => window.B20SenderHistory,
    addressBook: () => window.B20SenderAddressBook,
    exporter: () => window.B20SenderExport,
    progress: () => window.B20SenderProgress,
    session: () => window.B20SenderSession,
    gas: () => window.B20SenderGas,
    validator: () => window.B20SenderValidator
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

  function premiumConfig() {
    return state.config.premium || {};
  }

  function senderConfig() {
    return state.config.tokenSender || fallbackConfig.tokenSender;
  }

  function walletConfig() {
    return state.config.wallet || fallbackConfig.wallet;
  }

  function maxRecipients() {
    return Number(senderConfig().maxRecipients || 250);
  }

  function safeBatchSize() {
    return Number(senderConfig().safeBatchSize || 120);
  }

  function hasActiveLabPass() {
    return Boolean(state.premium && state.premium.license && state.premium.license.active);
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
      throw new Error('Configured sender address has no contract code on Base.');
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
        message: modules.core().errorMessage(error, 'Sender contract verification failed.')
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

  function buildSenderTransactionForRecipients(recipients) {
    if (!state.token || !hasSenderContract()) {
      throw new Error('Token and sender contract are required.');
    }

    const addresses = recipients.map((recipient) => recipient.address);
    const amounts = recipients.map((recipient) => recipient.amountRaw);
    const recipientsSegment = encodeAddressArray(addresses);
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

  function renderLabPassStatus(premiumState) {
    const target = query(selectors.labPassStatus);
    const label = query(selectors.premiumState);

    state.premium = premiumState || state.premium;

    if (!target) {
      return;
    }

    const license = state.premium?.license || {};
    const walletState = state.premium?.wallet || {};
    const active = Boolean(license.active);
    const title = target.querySelector('strong');
    const wallet = target.querySelector('[data-token-lab-pass-wallet]');
    const details = target.querySelector('[data-token-lab-pass-details]');

    target.classList.toggle('is-active', active);
    target.classList.toggle('is-inactive', !active);
    setText(label, active ? 'ACTIVE' : 'INACTIVE');
    setText(title, active ? 'Active' : 'Inactive');
    setText(wallet, walletState.address ? `Wallet: ${walletState.address}` : 'Wallet: not connected');

    if (details) {
      if (active) {
        details.textContent = `Expires: ${license.expiresAtLabel || '--'}`;
      } else if (license.error) {
        details.textContent = license.error;
      } else {
        details.textContent = 'Unlimited batches, imports, history and saved lists require Lab Pass.';
      }
    }
  }

  async function initPremium() {
    renderLabPassStatus(null);

    if (!window.B20Premium) {
      renderLabPassStatus({
        license: {
          active: false,
          error: 'Premium Core unavailable.'
        }
      });
      return;
    }

    window.B20Premium.subscribe((premiumState) => {
      renderLabPassStatus(premiumState);
      updateExecutionState();
    });
    await window.B20Premium.init();
  }

  async function requirePremiumFeature(featureId, featureLabel) {
    if (!window.B20Premium || typeof window.B20Premium.requireAccess !== 'function') {
      setText(query(selectors.importMessage), 'Lab Pass module unavailable.');
      return false;
    }

    try {
      const unlocked = await window.B20Premium.requireAccess(featureId, featureLabel);
      renderLabPassStatus(window.B20Premium.getState());

      if (!unlocked) {
        setText(query(selectors.importMessage), `${featureLabel} requires an active Lab Pass.`);
      }

      return unlocked;
    } catch (error) {
      setText(query(selectors.importMessage), modules.core().errorMessage(error, 'Lab Pass verification failed.'));
      renderLabPassStatus(window.B20Premium.getState());
      return false;
    }
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
    note.textContent = 'Step 1 approves only the exact preview amount. Step 2 sends optimized batches. Approval alone does not transfer tokens.';

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
      rows.push(createDetailRow('Batch Plan', `${state.preview.plan.totalBatches} batch${state.preview.plan.totalBatches === 1 ? '' : 'es'} / ${state.preview.plan.safeBatchSize} max recipients`));
      rows.push(createDetailRow('Sender Status', state.preview.senderMessage || 'Unknown'));
      rows.push(createDetailRow('Allowance Status', state.preview.allowanceReady ? 'READY FOR SEND' : 'APPROVAL REQUIRED'));
    }

    if (state.approvalTx) {
      rows.push(createDetailRow('Approval TX', state.approvalTx, basescanTxUrl(state.approvalTx)));
    }

    const hashes = (state.preview?.plan?.batches || []).filter((batch) => batch.txHash);
    hashes.forEach((batch) => {
      rows.push(createDetailRow(`Batch ${batch.number} TX`, batch.txHash, basescanTxUrl(batch.txHash)));
    });

    if (!hashes.length && state.batchTx) {
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

    const disconnectButton = query(selectors.disconnect);
    const switchButton = query(selectors.switchBase);

    if (disconnectButton) {
      disconnectButton.disabled = !walletState.connected;
    }

    if (switchButton) {
      switchButton.hidden = !walletState.connected || walletState.isBase;
    }

    if (window.B20Premium) {
      window.B20Premium.refreshLicense().catch(() => {});
    }

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

  function showErrors(errors, warnings = []) {
    const target = query(selectors.recipientErrors);

    if (!target) {
      return;
    }

    const messages = [...warnings, ...errors];

    if (!messages.length) {
      target.hidden = true;
      target.textContent = '';
      return;
    }

    target.hidden = false;
    target.textContent = messages.join('\n');
  }

  function parseRecipients() {
    return modules.importer().parseRecipients({
      text: query(selectors.recipients).value || '',
      defaultAmount: query(selectors.defaultAmount).value.trim(),
      decimals: state.token ? state.token.decimals : 18
    });
  }

  function renderPreview() {
    const preview = state.preview;
    const tokenSymbol = state.token ? state.token.symbol : 'TOKEN';

    setText(query(selectors.previewState), preview ? 'VALIDATED' : 'WAITING');
    setText(query(selectors.previewWallets), preview ? String(preview.recipients.length) : '0');
    setText(query(selectors.previewTotal), preview ? `${preview.totalFormatted} ${tokenSymbol}` : '0');
    setText(query(selectors.previewGas), preview ? preview.estimatedGas : 'Unavailable');
    setText(query(selectors.previewBatches), preview ? String(preview.plan.totalBatches) : '0');
    setText(query(selectors.previewDuplicates), preview ? String(preview.duplicatesRemoved || 0) : '0');
    setText(query(selectors.previewInvalid), preview ? String(preview.invalidLines || 0) : '0');

    const table = query(selectors.previewTable);

    if (!table) {
      return;
    }

    if (!preview) {
      table.innerHTML = '<p class="test-muted">No validated recipients yet.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    const renderLimit = 300;
    preview.recipients.slice(0, renderLimit).forEach((recipient, index) => {
      const row = document.createElement('div');
      row.className = 'sender-preview-row';

      const address = document.createElement('strong');
      address.textContent = `${index + 1}. ${recipient.address}`;

      const amount = document.createElement('span');
      amount.textContent = `${recipient.amount} ${tokenSymbol}`;

      row.append(address, amount);
      fragment.appendChild(row);
    });

    if (preview.recipients.length > renderLimit) {
      const note = document.createElement('p');
      note.className = 'test-muted';
      note.textContent = `Showing first ${renderLimit} of ${preview.recipients.length}. Full dataset remains in execution memory.`;
      fragment.appendChild(note);
    }

    table.replaceChildren(fragment);
  }

  function failedRecipientCount() {
    return modules.batcher().failedRecipients(state.preview?.plan).length;
  }

  function updateExecutionState() {
    const approveButton = query(selectors.approve);
    const sendButton = query(selectors.send);
    const retryButton = query(selectors.retryFailed);
    const exportTxtButton = query(selectors.exportFailedTxt);
    const exportCsvButton = query(selectors.exportFailedCsv);
    const canPreview = Boolean(state.preview);
    const connectedToBase = Boolean(state.wallet && state.wallet.connected && state.wallet.isBase);
    const contractReady = hasSenderContract();
    const hasAllowance = Boolean(state.preview && state.preview.allowanceReady);
    const senderReady = Boolean(state.preview && state.preview.senderReady);
    const hasFailed = failedRecipientCount() > 0;

    if (approveButton) {
      approveButton.disabled = state.sending || !canPreview || !connectedToBase || !contractReady || !senderReady || hasAllowance;
    }

    if (sendButton) {
      sendButton.disabled = state.sending || !canPreview || !connectedToBase || !contractReady || !senderReady || !hasAllowance;
      sendButton.textContent = state.preview && state.preview.plan.totalBatches > 1 ? 'Send Batches' : 'Send Batch';
    }

    if (retryButton) {
      retryButton.disabled = state.sending || !hasFailed;
    }

    if (exportTxtButton) {
      exportTxtButton.disabled = !hasFailed;
    }

    if (exportCsvButton) {
      exportCsvButton.disabled = !hasFailed;
    }
  }

  function resetTransactionState() {
    state.preview = null;
    state.approvalTx = '';
    state.batchTx = '';
    modules.progress().reset(query(selectors.progress));
    renderPreview();
    renderExecutionDetails();
    updateExecutionState();
    modules.session().save(selectors);
  }

  async function loadToken() {
    const address = query(selectors.tokenAddress).value.trim();

    try {
      modules.validator().ensureBaseWallet(state.wallet);

      state.token = await window.B20Wallet.readTokenInfo(address);
      resetTransactionState();
      renderTokenReadout();
      showErrors([]);
      setText(query(selectors.executionMessage), 'Token specimen loaded. Recipient validation can begin.');
    } catch (error) {
      state.token = null;
      resetTransactionState();
      renderTokenReadout();
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Token read failed.'));
    }
  }

  async function validatePreview() {
    try {
      modules.validator().ensureBaseWallet(state.wallet);

      if (!state.token) {
        throw new Error('Read token contract before preview.');
      }

      const parsed = parseRecipients();

      if (parsed.errors.length) {
        state.preview = null;
        showErrors(parsed.errors, parsed.warnings);
        renderPreview();
        renderExecutionDetails();
        updateExecutionState();
        return;
      }

      const needsUnlimited = parsed.recipients.length > maxRecipients();
      const unlimitedUnlocked = needsUnlimited
        ? await requirePremiumFeature('tokenSenderUnlimitedBatch', 'Unlimited Batch Sending')
        : hasActiveLabPass();

      if (needsUnlimited && !unlimitedUnlocked) {
        state.preview = null;
        showErrors([`Batch contains ${parsed.recipients.length} recipients. Lab Pass is required above ${maxRecipients()}.`], parsed.warnings);
        renderPreview();
        renderExecutionDetails();
        updateExecutionState();
        return;
      }

      if (state.token.balanceRaw && parsed.totalRaw > BigInt(state.token.balanceRaw)) {
        state.preview = null;
        showErrors([`Insufficient wallet balance. Required ${parsed.totalFormatted} ${state.token.symbol}, available ${state.token.balance} ${state.token.symbol}.`], parsed.warnings);
        renderPreview();
        renderExecutionDetails();
        updateExecutionState();
        return;
      }

      const plan = modules.batcher().buildPlan(parsed.recipients, {
        unlimited: needsUnlimited || hasActiveLabPass(),
        maxRecipients: maxRecipients(),
        safeBatchSize: safeBatchSize(),
        hardBatchSize: maxRecipients()
      });

      showErrors([], parsed.warnings);
      const preview = {
        recipients: parsed.recipients,
        totalRaw: parsed.totalRaw.toString(),
        totalFormatted: parsed.totalFormatted,
        duplicatesRemoved: parsed.duplicatesRemoved,
        invalidLines: parsed.invalidLines,
        variableAmounts: parsed.variableAmounts,
        allowanceReady: false,
        senderReady: false,
        senderMessage: '',
        estimatedGas: hasSenderContract()
          ? modules.gas().summarize(plan)
          : 'Unavailable until sender contract is configured',
        plan
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

        if (preview.allowanceReady && plan.batches.length) {
          try {
            const gas = await window.B20Wallet.estimateGas(buildSenderTransactionForRecipients(plan.batches[0].recipients));
            preview.estimatedGas = modules.gas().summarize(plan, BigInt(gas).toString());
          } catch (error) {
            preview.estimatedGas = modules.gas().summarize(plan);
          }
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
      modules.session().save(selectors, { preview: minimalPreviewSession() });
      setText(
        query(selectors.executionMessage),
        preview.senderReady
          ? `Dry run complete. ${preview.plan.totalBatches} optimized batch${preview.plan.totalBatches === 1 ? '' : 'es'} prepared.`
          : `Preview validated. ${preview.senderMessage}`
      );
    } catch (error) {
      state.preview = null;
      renderPreview();
      renderExecutionDetails();
      updateExecutionState();
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Preview failed.'));
    }
  }

  function minimalPreviewSession() {
    if (!state.preview) {
      return null;
    }

    return {
      token: state.token,
      totalRaw: state.preview.totalRaw,
      totalFormatted: state.preview.totalFormatted,
      batchStatuses: state.preview.plan.batches.map((batch) => ({
        number: batch.number,
        status: batch.status,
        txHash: batch.txHash,
        error: batch.error
      }))
    };
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
      modules.session().save(selectors, { preview: minimalPreviewSession() });
      setText(query(selectors.executionMessage), 'Exact approval confirmed. Now press Send Batch to move tokens.');
    } catch (error) {
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Approval rejected.'));
    }
  }

  function progressSnapshot(label, completedBatches) {
    const plan = state.preview?.plan;
    const completedWallets = (plan?.batches || [])
      .filter((batch) => batch.status === 'confirmed')
      .reduce((total, batch) => total + batch.recipients.length, 0);

    return {
      label,
      completedBatches,
      totalBatches: plan?.totalBatches || 0,
      completedWallets,
      totalWallets: plan?.totalRecipients || 0,
      eta: '--'
    };
  }

  async function sendBatch() {
    const startedAt = Date.now();

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

      state.sending = true;
      updateExecutionState();
      const plan = state.preview.plan;

      for (const batch of plan.batches) {
        if (batch.status === 'confirmed') {
          continue;
        }

        batch.status = 'submitting';
        modules.progress().render(query(selectors.progress), progressSnapshot(`Submitting batch ${batch.number}...`, batch.number - 1));
        setText(query(selectors.executionMessage), `Awaiting wallet confirmation for batch ${batch.number} / ${plan.totalBatches}...`);

        try {
          const txHash = await window.B20Wallet.sendTransaction(buildSenderTransactionForRecipients(batch.recipients));
          batch.txHash = txHash;
          state.batchTx = txHash;
          renderExecutionDetails();
          setText(query(selectors.executionMessage), `Batch ${batch.number} submitted. Full hash: ${txHash}. Waiting for confirmation...`);

          const receipt = await window.B20Wallet.waitForTransactionReceipt(txHash);

          if (receipt.status && receipt.status !== '0x1') {
            throw new Error('Batch transaction failed.');
          }

          batch.status = 'confirmed';
          modules.progress().render(query(selectors.progress), progressSnapshot(`Batch ${batch.number} confirmed.`, batch.number));
          modules.session().save(selectors, { preview: minimalPreviewSession() });
        } catch (error) {
          batch.status = 'failed';
          batch.error = modules.core().errorMessage(error, 'Batch send failed.');
          renderExecutionDetails();
          modules.session().save(selectors, { preview: minimalPreviewSession() });
          throw new Error(`Batch ${batch.number} failed. ${batch.error}`);
        }
      }

      state.preview.allowanceReady = false;
      state.approvalTx = '';
      modules.progress().render(query(selectors.progress), {
        label: 'Distribution complete.',
        completedBatches: plan.totalBatches,
        totalBatches: plan.totalBatches,
        completedWallets: plan.totalRecipients,
        totalWallets: plan.totalRecipients,
        eta: modules.core().formatDuration(Date.now() - startedAt)
      });
      addHistoryRecord('confirmed', startedAt);
      updateExecutionState();
      renderExecutionDetails();
      renderHistory();
      modules.session().save(selectors, { preview: minimalPreviewSession() });
      setText(query(selectors.executionMessage), `Distribution confirmed. ${plan.totalRecipients} wallets processed across ${plan.totalBatches} batch${plan.totalBatches === 1 ? '' : 'es'}.`);
    } catch (error) {
      addHistoryRecord('partial', startedAt);
      updateExecutionState();
      renderHistory();
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Batch send rejected.'));
    } finally {
      state.sending = false;
      updateExecutionState();
    }
  }

  function addHistoryRecord(status, startedAt) {
    if (!state.preview || !state.token) {
      return;
    }

    const plan = state.preview.plan;
    const hashes = plan.batches.map((batch) => batch.txHash).filter(Boolean);
    modules.history().add({
      status,
      token: state.token.symbol,
      tokenAddress: state.token.address,
      walletCount: plan.totalRecipients,
      totalTokens: `${state.preview.totalFormatted} ${state.token.symbol}`,
      batchCount: plan.totalBatches,
      hashes,
      failed: failedRecipientCount(),
      gas: state.preview.estimatedGas,
      elapsed: modules.core().formatDuration(Date.now() - startedAt)
    });
  }

  async function retryFailed() {
    try {
      if (!(await requirePremiumFeature('tokenSenderRetryFailed', 'Retry Failed'))) {
        return;
      }

      if (!state.preview || !state.token) {
        throw new Error('No failed batch state available.');
      }

      const failed = modules.batcher().failedRecipients(state.preview.plan);

      if (!failed.length) {
        throw new Error('No failed wallets available for retry.');
      }

      const totalRaw = modules.batcher().batchTotalRaw(failed);
      const plan = modules.batcher().buildPlan(failed, {
        unlimited: true,
        maxRecipients: maxRecipients(),
        safeBatchSize: safeBatchSize(),
        hardBatchSize: maxRecipients()
      });
      const allowanceRaw = await window.B20Wallet.readTokenAllowance(
        state.token.address,
        state.wallet.address,
        senderConfig().contractAddress
      );

      state.preview = {
        ...state.preview,
        recipients: failed,
        totalRaw: totalRaw.toString(),
        totalFormatted: window.B20Wallet.formatUnits(totalRaw, state.token.decimals, 6),
        allowanceReady: BigInt(allowanceRaw) >= totalRaw,
        plan
      };

      renderPreview();
      renderExecutionDetails();
      updateExecutionState();

      if (!state.preview.allowanceReady) {
        setText(query(selectors.executionMessage), 'Failed-wallet retry prepared. Approve exact retry amount before sending.');
        return;
      }

      await sendBatch();
    } catch (error) {
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Retry failed unavailable.'));
    }
  }

  function renderAddressBook() {
    const select = query(selectors.bookList);

    if (!select) {
      return;
    }

    const current = select.value;
    const books = modules.addressBook().list();
    select.replaceChildren();

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = books.length ? 'Saved lists' : 'No saved lists';
    select.appendChild(empty);

    books.forEach((book) => {
      const option = document.createElement('option');
      option.value = book.id;
      option.textContent = `${book.name} (${String(book.recipientsText || '').split(/\r?\n/).filter(Boolean).length})`;
      select.appendChild(option);
    });

    if (books.some((book) => book.id === current)) {
      select.value = current;
    }
  }

  async function saveAddressBook() {
    if (!(await requirePremiumFeature('tokenSenderAddressBook', 'Address Book'))) {
      return;
    }

    const recipientsText = query(selectors.recipients).value || '';

    if (!recipientsText.trim()) {
      setText(query(selectors.importMessage), 'No recipients available to save.');
      return;
    }

    const item = modules.addressBook().save(query(selectors.bookName).value, {
      tokenAddress: query(selectors.tokenAddress).value,
      defaultAmount: query(selectors.defaultAmount).value,
      recipientsText
    });
    renderAddressBook();
    query(selectors.bookList).value = item.id;
    setText(query(selectors.importMessage), `Saved recipient list: ${item.name}.`);
  }

  async function loadAddressBook() {
    if (!(await requirePremiumFeature('tokenSenderAddressBook', 'Address Book'))) {
      return;
    }

    const id = query(selectors.bookList).value;
    const book = modules.addressBook().list().find((item) => item.id === id);

    if (!book) {
      setText(query(selectors.importMessage), 'Select a saved recipient list first.');
      return;
    }

    query(selectors.tokenAddress).value = book.tokenAddress || query(selectors.tokenAddress).value;
    query(selectors.defaultAmount).value = book.defaultAmount || '';
    query(selectors.recipients).value = book.recipientsText || '';
    resetTransactionState();
    setText(query(selectors.importMessage), `Loaded recipient list: ${book.name}.`);
  }

  async function duplicateAddressBook() {
    if (!(await requirePremiumFeature('tokenSenderAddressBook', 'Address Book'))) {
      return;
    }

    const id = query(selectors.bookList).value;
    const item = modules.addressBook().duplicate(id);
    renderAddressBook();
    query(selectors.bookList).value = item.id;
    setText(query(selectors.importMessage), `Duplicated recipient list: ${item.name}.`);
  }

  async function deleteAddressBook() {
    if (!(await requirePremiumFeature('tokenSenderAddressBook', 'Address Book'))) {
      return;
    }

    const id = query(selectors.bookList).value;

    if (!id) {
      setText(query(selectors.importMessage), 'Select a saved recipient list first.');
      return;
    }

    modules.addressBook().remove(id);
    renderAddressBook();
    setText(query(selectors.importMessage), 'Recipient list deleted.');
  }

  async function beginImport(mode) {
    if (!(await requirePremiumFeature('tokenSenderImport', mode === 'csv' ? 'CSV Import' : 'TXT Import'))) {
      return;
    }

    state.importMode = mode;
    const input = query(selectors.importFile);

    if (input) {
      input.value = '';
      input.click();
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      return;
    }

    try {
      setText(query(selectors.importMessage), `Importing ${state.importMode.toUpperCase()} file...`);
      const text = await modules.importer().readFile(file);
      query(selectors.recipients).value = text.trim();
      resetTransactionState();
      setText(query(selectors.importMessage), `${state.importMode.toUpperCase()} imported. Validate preview before approval.`);
    } catch (error) {
      setText(query(selectors.importMessage), modules.core().errorMessage(error, 'Import failed.'));
    }
  }

  function renderHistory() {
    const target = query(selectors.history);

    if (!target) {
      return;
    }

    const history = modules.history().list();

    if (!history.length) {
      target.innerHTML = '<p class="test-muted">No local distribution history yet.</p>';
      return;
    }

    target.replaceChildren(...history.slice(0, 20).map((item) => {
      const row = document.createElement('div');
      row.className = 'sender-history-item';

      const title = document.createElement('strong');
      title.textContent = `${item.status.toUpperCase()} / ${item.walletCount} wallets / ${item.totalTokens}`;

      const meta = document.createElement('span');
      meta.textContent = `${new Date(item.date).toLocaleString('en-US')} · ${item.batchCount} batch${item.batchCount === 1 ? '' : 'es'} · ${item.elapsed || '--'}`;

      const hashes = document.createElement('div');
      hashes.className = 'sender-history-hashes';
      (item.hashes || []).forEach((hash) => {
        const link = document.createElement('a');
        link.href = basescanTxUrl(hash);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = hash;
        hashes.appendChild(link);
      });

      row.append(title, meta, hashes);
      return row;
    }));
  }

  function clearHistory() {
    modules.history().clear();
    renderHistory();
    setText(query(selectors.executionMessage), 'Local sender history cleared.');
  }

  async function exportFailed(type) {
    try {
      if (!(await requirePremiumFeature('tokenSenderRetryFailed', 'Failed Wallet Export'))) {
        return;
      }

      if (type === 'csv') {
        modules.exporter().exportFailedCsv(state.token, state.preview?.plan);
      } else {
        modules.exporter().exportFailedTxt(state.token, state.preview?.plan);
      }
      setText(query(selectors.executionMessage), `Failed-wallet ${type.toUpperCase()} export prepared.`);
    } catch (error) {
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Failed export unavailable.'));
    }
  }

  function consumeParserInbox() {
    const inbox = modules.storage().consumeParserRecipients();

    if (!inbox || !Array.isArray(inbox.addresses) || !inbox.addresses.length) {
      return;
    }

    if (inbox.tokenAddress && !query(selectors.tokenAddress).value.trim()) {
      query(selectors.tokenAddress).value = inbox.tokenAddress;
    }

    query(selectors.recipients).value = inbox.addresses.join('\n');
    setText(query(selectors.importMessage), `Received ${inbox.addresses.length} holders from Wallet Parser. Add amount, then validate preview.`);
    modules.session().save(selectors);
  }

  function bindEvents() {
    const bind = (selector, eventName, handler) => {
      const element = query(selector);
      if (element) {
        element.addEventListener(eventName, handler);
      }
    };

    bind(selectors.connect, 'click', () => {
      window.B20Wallet.connect(state.selectedProviderId).catch((error) => {
        setText(query(selectors.walletMessage), modules.core().errorMessage(error, 'Wallet connection rejected.'));
      });
    });
    bind(selectors.disconnect, 'click', () => window.B20Wallet.disconnect());
    bind(selectors.switchBase, 'click', () => {
      window.B20Wallet.switchToBase().catch((error) => {
        setText(query(selectors.walletMessage), modules.core().errorMessage(error, 'Network switch rejected.'));
      });
    });
    bind(selectors.loadToken, 'click', loadToken);
    bind(selectors.tokenAddress, 'input', () => {
      state.token = null;
      resetTransactionState();
      renderTokenReadout();
    });
    bind(selectors.preview, 'click', validatePreview);
    bind(selectors.defaultAmount, 'input', resetTransactionState);
    bind(selectors.recipients, 'input', () => {
      showErrors([]);
      resetTransactionState();
    });
    bind(selectors.importTxt, 'click', () => beginImport('txt'));
    bind(selectors.importCsv, 'click', () => beginImport('csv'));
    bind(selectors.importFile, 'change', handleImportFile);
    bind(selectors.bookSave, 'click', saveAddressBook);
    bind(selectors.bookLoad, 'click', loadAddressBook);
    bind(selectors.bookDuplicate, 'click', duplicateAddressBook);
    bind(selectors.bookDelete, 'click', deleteAddressBook);
    bind(selectors.approve, 'click', approveExactAmount);
    bind(selectors.send, 'click', sendBatch);
    bind(selectors.retryFailed, 'click', retryFailed);
    bind(selectors.exportFailedTxt, 'click', () => exportFailed('txt'));
    bind(selectors.exportFailedCsv, 'click', () => exportFailed('csv'));
    bind(selectors.historyClear, 'click', clearHistory);
  }

  async function initTokenSender() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    await loadConfig();
    bindEvents();
    modules.session().restore(selectors);
    consumeParserInbox();
    renderTokenReadout();
    renderPreview();
    renderAddressBook();
    renderHistory();

    window.B20Wallet.init({
      walletConnectProjectId: walletConfig().walletConnectProjectId,
      baseChainId: walletConfig().defaultChainId,
      appName: '0XB20 Token Sender',
      appDescription: 'Protected batch distribution instrument.',
      appUrl: 'https://0xb20.lol/token-sender',
      autoRestore: true
    });
    window.B20Wallet.subscribe(renderWallet);
    await initPremium();

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
