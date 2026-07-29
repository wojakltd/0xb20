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
      contractName: '0XB20 Asset Sender Legacy ERC20',
      approvalMode: 'exact',
      maxRecipients: 250,
      safeBatchSize: 120
    },
    assetSender: {
      enabled: true,
      chainId: '0x2105',
      network: 'BASE',
      contractAddress: '',
      contractName: '0XB20 Asset Sender V2',
      approvalMode: 'adapter',
      directTransferFallback: true,
      safeBatchSize: {
        erc20: 120,
        erc721: 40,
        erc1155: 60
      }
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
    assetTokenIdPanel: '[data-asset-token-id-panel]',
    assetTokenIds: '[data-asset-token-ids]',
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
    assetAdapter: null,
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
    validator: () => window.B20SenderValidator,
    abi: () => window.B20SenderAbi,
    adapters: () => window.B20AssetAdapters
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

  function parseAssetTargetInput(value) {
    const raw = String(value || '').trim();
    const sanitized = raw.split(/[?#]/)[0].trim();
    const addressMatch = sanitized.match(/0x[a-fA-F0-9]{40}/);

    if (!addressMatch) {
      return {
        address: raw,
        tokenId: ''
      };
    }

    const address = addressMatch[0];
    const suffix = sanitized.slice(addressMatch.index + address.length);
    const tokenIdMatch = suffix.match(/^\/+(\d+)\/?$/);

    return {
      address,
      tokenId: tokenIdMatch ? tokenIdMatch[1] : ''
    };
  }

  function formatAssetTargetInput(target) {
    if (!target?.address) {
      return '';
    }

    return target.tokenId ? `${target.address}/${target.tokenId}` : target.address;
  }

  function queueDetectedAssetId(tokenId) {
    const target = query(selectors.assetTokenIds);

    if (!target || !tokenId) {
      return false;
    }

    target.value = tokenId;
    return true;
  }

  function premiumConfig() {
    return state.config.premium || {};
  }

  function senderConfig() {
    return state.config.tokenSender || fallbackConfig.tokenSender;
  }

  function assetSenderConfig() {
    return state.config.assetSender || fallbackConfig.assetSender;
  }

  function activeAssetType() {
    return state.assetAdapter?.type || state.token?.type || 'erc20';
  }

  function activeAssetLabel() {
    return state.assetAdapter?.label || state.token?.assetType || activeAssetType().toUpperCase();
  }

  function currentAdapter() {
    if (state.assetAdapter) {
      return state.assetAdapter;
    }

    if (state.token && modules.adapters()) {
      return modules.adapters().createErc20Adapter(state.token.address);
    }

    return null;
  }

  function walletConfig() {
    return state.config.wallet || fallbackConfig.wallet;
  }

  function maxRecipients() {
    return Number(senderConfig().maxRecipients || 250);
  }

  function safeBatchSize() {
    const adapter = currentAdapter();

    if (adapter && !adapter.usesSenderContract) {
      return 1;
    }

    const configured = assetSenderConfig().safeBatchSize;

    if (configured && typeof configured === 'object') {
      return Number(configured[activeAssetType()] || configured.erc20 || senderConfig().safeBatchSize || 120);
    }

    return Number(configured || senderConfig().safeBatchSize || 120);
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

  function hasUniversalSenderContract() {
    const config = assetSenderConfig();
    return Boolean(config.enabled !== false && config.contractAddress && window.B20Wallet.isAddress(config.contractAddress));
  }

  function hasActiveSenderContract(adapter = currentAdapter()) {
    if (!adapter || !adapter.usesSenderContract) {
      return true;
    }

    if (adapter.type === 'erc20') {
      return hasUniversalSenderContract() || hasSenderContract();
    }

    return hasUniversalSenderContract();
  }

  async function requireAdapterReadiness(adapter, parsed = state.preview) {
    if (!adapter) {
      throw new Error('Asset adapter unavailable.');
    }

    const status = await adapter.getReadiness({
      parsed,
      token: state.token,
      wallet: state.wallet,
      senderConfig: senderConfig(),
      assetSenderConfig: assetSenderConfig()
    });

    if (!status.ready) {
      throw new Error(status.message || 'Asset sender is not ready.');
    }

    return status;
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
    const adapter = currentAdapter();

    if (!state.token || !adapter) {
      throw new Error('Asset adapter is required.');
    }

    return adapter.buildBatchTransaction({
      token: state.token,
      wallet: state.wallet,
      recipients,
      senderConfig: senderConfig(),
      assetSenderConfig: assetSenderConfig()
    });
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
    const legacyConfig = senderConfig();
    const universalConfig = assetSenderConfig();

    if (!target) {
      return;
    }

    target.replaceChildren();

    const title = document.createElement('p');
    title.textContent = hasUniversalSenderContract()
      ? `${universalConfig.contractName} configured on ${universalConfig.network}. Universal batch mode available.`
      : 'Universal Asset Sender V2 is not configured yet. ERC20 legacy mode and direct NFT transfers remain available.';

    const note = document.createElement('p');
    note.textContent = hasUniversalSenderContract()
      ? 'ERC20, ERC721 and ERC1155 use adapter-specific authorization and the same sequential batching engine.'
      : 'ERC721 and ERC1155 use direct safe transfers from the connected wallet until the V2 contract address is deployed.';

    target.append(title, note);

    if (hasSenderContract()) {
      target.append(createDetailRow('Legacy ERC20 Sender', legacyConfig.contractAddress, basescanAddressUrl(legacyConfig.contractAddress)));
    } else {
      target.append(createDetailRow('Legacy ERC20 Sender', 'Not configured'));
    }

    if (hasUniversalSenderContract()) {
      target.append(createDetailRow('Universal Asset Sender V2', universalConfig.contractAddress, basescanAddressUrl(universalConfig.contractAddress)));
    } else {
      target.append(createDetailRow('Universal Asset Sender V2', 'Awaiting deployment'));
    }

    renderExecutionDetails();
  }

  function renderExecutionDetails() {
    const target = query(selectors.executionDetails);

    if (!target) {
      return;
    }

    const rows = [];

    if (state.token) {
      rows.push(createDetailRow('Asset Contract', state.token.address, basescanAddressUrl(state.token.address)));
      rows.push(createDetailRow('Asset Type', activeAssetLabel()));
    }

    if (state.preview) {
      rows.push(createDetailRow('Transfer Total', state.preview.totalLabel || `${state.preview.totalFormatted} ${state.token ? state.token.symbol : 'ASSET'}`));
      rows.push(createDetailRow('Batch Plan', `${state.preview.plan.totalBatches} batch${state.preview.plan.totalBatches === 1 ? '' : 'es'} / ${state.preview.plan.safeBatchSize} max transfers`));
      rows.push(createDetailRow('Execution Mode', state.preview.senderMessage || 'Unknown'));
      rows.push(createDetailRow('Authorization Status', state.preview.requiresApproval
        ? (state.preview.allowanceReady ? 'READY FOR SEND' : 'APPROVAL REQUIRED')
        : 'DIRECT WALLET CONFIRMATION'));
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
    const idPanel = query(selectors.assetTokenIdPanel);

    if (!target) {
      return;
    }

    if (idPanel) {
      idPanel.hidden = !['erc721', 'erc1155'].includes(activeAssetType());
    }

    const values = state.token
      ? [
          `Asset Type: ${activeAssetLabel()}`,
          `Symbol: ${state.token.symbol}`,
          `Name: ${state.token.name}`,
          state.token.selectedTokenId ? `Selected ID: ${state.token.selectedTokenId}` : '',
          `Wallet Balance: ${state.token.balanceLabel || `${state.token.balance} ${state.token.symbol}`}`
        ].filter(Boolean)
      : ['Asset Type: --', 'Symbol: --', 'Name: --', 'Wallet Balance: --'];

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
    const adapter = currentAdapter();

    if (!adapter) {
      throw new Error('Detect asset contract before parsing recipients.');
    }

    return adapter.parseRecipients({
      text: query(selectors.recipients).value || '',
      defaultAmount: query(selectors.defaultAmount).value.trim(),
      decimals: state.token ? state.token.decimals : 18,
      tokenIdsText: query(selectors.assetTokenIds)?.value || '',
      token: state.token,
      wallet: state.wallet
    });
  }

  function renderPreview() {
    const preview = state.preview;
    const tokenSymbol = state.token ? state.token.symbol : 'TOKEN';
    const adapter = currentAdapter();

    setText(query(selectors.previewState), preview ? 'VALIDATED' : 'WAITING');
    setText(query(selectors.previewWallets), preview ? String(preview.recipients.length) : '0');
    setText(query(selectors.previewTotal), preview ? preview.totalLabel || `${preview.totalFormatted} ${tokenSymbol}` : '0');
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
      amount.textContent = adapter?.describeRecipient
        ? adapter.describeRecipient(recipient, state.token)
        : `${recipient.amount} ${tokenSymbol}`;

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
    const adapter = currentAdapter();
    const requiresApproval = Boolean(state.preview && state.preview.requiresApproval);
    const contractReady = hasActiveSenderContract(adapter);
    const hasAllowance = Boolean(state.preview && state.preview.allowanceReady);
    const senderReady = Boolean(state.preview && state.preview.senderReady);
    const hasFailed = failedRecipientCount() > 0;

    if (approveButton) {
      approveButton.disabled = state.sending || !canPreview || !connectedToBase || !contractReady || !senderReady || !requiresApproval || hasAllowance;
      approveButton.textContent = requiresApproval ? 'Authorize Asset' : 'No Approval Required';
    }

    if (sendButton) {
      sendButton.disabled = state.sending || !canPreview || !connectedToBase || !contractReady || !senderReady || (requiresApproval && !hasAllowance);
      sendButton.textContent = state.preview && state.preview.plan.totalBatches > 1 ? 'Send Assets' : 'Send Asset';
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
    const targetInput = query(selectors.tokenAddress);
    const parsedTarget = parseAssetTargetInput(targetInput.value);
    const address = parsedTarget.address;

    try {
      modules.validator().ensureBaseWallet(state.wallet);

      if (!modules.adapters()) {
        throw new Error('Asset adapter layer unavailable.');
      }

      targetInput.value = formatAssetTargetInput(parsedTarget);
      const queuedTokenId = queueDetectedAssetId(parsedTarget.tokenId);

      state.assetAdapter = await modules.adapters().detect({
        address,
        tokenId: parsedTarget.tokenId,
        owner: state.wallet.address,
        senderConfig: senderConfig(),
        assetSenderConfig: assetSenderConfig()
      });
      state.token = await state.assetAdapter.readMetadata({
        address: state.assetAdapter.address,
        tokenId: parsedTarget.tokenId,
        owner: state.wallet.address,
        wallet: state.wallet
      });
      resetTransactionState();
      renderTokenReadout();
      showErrors([]);
      setText(
        query(selectors.executionMessage),
        queuedTokenId
          ? `${state.assetAdapter.label} specimen loaded. Token ID #${parsedTarget.tokenId} queued from item link.`
          : `${state.assetAdapter.label} specimen loaded. Recipient validation can begin.`
      );
    } catch (error) {
      state.token = null;
      state.assetAdapter = null;
      resetTransactionState();
      renderTokenReadout();
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Asset read failed.'));
    }
  }

  async function validatePreview() {
    try {
      modules.validator().ensureBaseWallet(state.wallet);

      if (!state.token) {
        throw new Error('Detect asset contract before preview.');
      }

      const adapter = currentAdapter();

      if (!adapter) {
        throw new Error('Asset adapter unavailable.');
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

      await adapter.validateTransfer({
        parsed,
        token: state.token,
        wallet: state.wallet,
        senderConfig: senderConfig(),
        assetSenderConfig: assetSenderConfig()
      });

      const needsUnlimited = parsed.recipients.length > maxRecipients();
      const unlimitedUnlocked = needsUnlimited
        ? await requirePremiumFeature('tokenSenderUnlimitedBatch', 'Unlimited Batch Sending')
        : hasActiveLabPass();

      if (needsUnlimited && !unlimitedUnlocked) {
        state.preview = null;
        showErrors([`Batch contains ${parsed.recipients.length} transfers. Lab Pass is required above ${maxRecipients()}.`], parsed.warnings);
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
      const senderStatus = await adapter.getReadiness({
        parsed,
        token: state.token,
        wallet: state.wallet,
        senderConfig: senderConfig(),
        assetSenderConfig: assetSenderConfig()
      });
      const approval = senderStatus.ready
        ? await adapter.readApprovalState({
            parsed,
            token: state.token,
            wallet: state.wallet,
            senderConfig: senderConfig(),
            assetSenderConfig: assetSenderConfig()
          })
        : {
            raw: '0',
            ready: false,
            message: senderStatus.message
          };
      const preview = {
        assetType: adapter.type,
        assetLabel: adapter.label,
        recipients: parsed.recipients,
        totalRaw: parsed.totalRaw.toString(),
        totalFormatted: parsed.totalFormatted,
        totalLabel: parsed.totalLabel || `${parsed.totalFormatted} ${state.token.symbol}`,
        duplicatesRemoved: parsed.duplicatesRemoved,
        invalidLines: parsed.invalidLines,
        variableAmounts: parsed.variableAmounts,
        requiresApproval: Boolean(adapter.requiresApproval),
        allowanceRaw: approval.raw || '0',
        allowanceReady: Boolean(approval.ready),
        senderReady: Boolean(senderStatus.ready),
        senderMessage: senderStatus.message || approval.message || `${adapter.label} execution mode ready.`,
        estimatedGas: senderStatus.ready
          ? modules.gas().summarize(plan)
          : senderStatus.message,
        plan
      };

      if (senderStatus.ready && plan.batches.length && (!preview.requiresApproval || preview.allowanceReady)) {
        try {
          const gas = await window.B20Wallet.estimateGas(buildSenderTransactionForRecipients(plan.batches[0].recipients));
          preview.estimatedGas = modules.gas().summarize(plan, BigInt(gas).toString());
        } catch (error) {
          preview.estimatedGas = modules.gas().summarize(plan);
        }
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
          ? `Dry run complete. ${preview.plan.totalBatches} optimized asset batch${preview.plan.totalBatches === 1 ? '' : 'es'} prepared.`
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
      assetType: state.preview.assetType,
      assetLabel: state.preview.assetLabel,
      totalRaw: state.preview.totalRaw,
      totalFormatted: state.preview.totalFormatted,
      totalLabel: state.preview.totalLabel,
      requiresApproval: state.preview.requiresApproval,
      allowanceRaw: state.preview.allowanceRaw,
      allowanceReady: state.preview.allowanceReady,
      batchStatuses: state.preview.plan.batches.map((batch) => ({
        number: batch.number,
        status: batch.status,
        txHash: batch.txHash,
        error: batch.error
      }))
    };
  }

  async function refreshApprovalState(adapter, successMessage) {
    if (!adapter || !state.preview || !state.token) {
      return false;
    }

    if (!adapter.requiresApproval) {
      state.preview.allowanceReady = true;
      updateExecutionState();
      renderExecutionDetails();
      modules.session().save(selectors, { preview: minimalPreviewSession() });
      return true;
    }

    try {
      const approval = await adapter.readApprovalState({
        parsed: state.preview,
        token: state.token,
        wallet: state.wallet,
        senderConfig: senderConfig(),
        assetSenderConfig: assetSenderConfig()
      });

      state.preview.allowanceRaw = approval.raw || '0';
      state.preview.allowanceReady = Boolean(approval.ready);
      updateExecutionState();
      renderExecutionDetails();
      modules.session().save(selectors, { preview: minimalPreviewSession() });

      if (state.preview.allowanceReady && successMessage) {
        setText(query(selectors.executionMessage), successMessage);
      }

      return state.preview.allowanceReady;
    } catch (error) {
      updateExecutionState();
      renderExecutionDetails();
      setText(
        query(selectors.executionMessage),
        modules.core().errorMessage(error, 'Authorization submitted, but on-chain approval could not be refreshed. Reconnect wallet and press Validate Preview.')
      );
      return false;
    }
  }

  async function approveExactAmount() {
    try {
      if (!state.preview || !state.token) {
        throw new Error('Validate preview before approval.');
      }

      const adapter = currentAdapter();

      if (!adapter) {
        throw new Error('Asset adapter unavailable.');
      }

      if (!adapter.requiresApproval) {
        state.preview.allowanceReady = true;
        updateExecutionState();
        renderExecutionDetails();
        setText(query(selectors.executionMessage), 'No separate authorization required. Press Send Asset to continue.');
        return;
      }

      await requireAdapterReadiness(adapter);

      const txHash = await adapter.requestApproval({
        token: state.token,
        wallet: state.wallet,
        senderConfig: senderConfig(),
        assetSenderConfig: assetSenderConfig(),
        parsed: state.preview,
        totalRaw: state.preview.totalRaw
      });

      state.approvalTx = txHash;
      renderExecutionDetails();
      setText(query(selectors.executionMessage), `Asset authorization submitted. Full hash: ${txHash}. Waiting for confirmation...`);

      let receipt = null;

      try {
        receipt = await window.B20Wallet.waitForTransactionReceipt(txHash);
      } catch (waitError) {
        setText(
          query(selectors.executionMessage),
          `Authorization transaction submitted. Full hash: ${txHash}. Refreshing approval state from Base...`
        );
      }

      if (receipt && receipt.status && receipt.status !== '0x1') {
        throw new Error('Authorization transaction failed.');
      }

      const approved = await refreshApprovalState(adapter, 'Asset authorization confirmed on-chain. Press Send Assets to start distribution.');

      if (!approved) {
        setText(
          query(selectors.executionMessage),
          `Authorization transaction submitted. Full hash: ${txHash}. If Base is still indexing it, press Validate Preview again in a few seconds.`
        );
      }
    } catch (error) {
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Authorization rejected.'));
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

      const adapter = currentAdapter();

      if (!adapter) {
        throw new Error('Asset adapter unavailable.');
      }

      await requireAdapterReadiness(adapter);

      if (adapter.requiresApproval && !state.preview.allowanceReady) {
        const approved = await refreshApprovalState(adapter, 'Authorization found on-chain. Starting distribution...');

        if (!approved) {
          throw new Error('Authorize asset before sending. If authorization was already confirmed, press Validate Preview and try again.');
        }
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
        setText(query(selectors.executionMessage), `Awaiting wallet confirmation for asset batch ${batch.number} / ${plan.totalBatches}...`);

        try {
          const txHash = await window.B20Wallet.sendTransaction(buildSenderTransactionForRecipients(batch.recipients));
          batch.txHash = txHash;
          state.batchTx = txHash;
          renderExecutionDetails();
          setText(query(selectors.executionMessage), `Asset batch ${batch.number} submitted. Full hash: ${txHash}. Waiting for confirmation...`);

          const receipt = await window.B20Wallet.waitForTransactionReceipt(txHash);

          if (receipt.status && receipt.status !== '0x1') {
            throw new Error('Batch transaction failed.');
          }

          batch.status = 'confirmed';
          modules.progress().render(query(selectors.progress), progressSnapshot(`Asset batch ${batch.number} confirmed.`, batch.number));
          modules.session().save(selectors, { preview: minimalPreviewSession() });
        } catch (error) {
          batch.status = 'failed';
          batch.error = modules.core().errorMessage(error, 'Asset batch send failed.');
          renderExecutionDetails();
          modules.session().save(selectors, { preview: minimalPreviewSession() });
          throw new Error(`Asset batch ${batch.number} failed. ${batch.error}`);
        }
      }

      if (adapter.requiresApproval) {
        state.preview.allowanceReady = false;
        state.approvalTx = '';
      }

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
      setText(query(selectors.executionMessage), `Asset distribution confirmed. ${plan.totalRecipients} transfer${plan.totalRecipients === 1 ? '' : 's'} processed across ${plan.totalBatches} batch${plan.totalBatches === 1 ? '' : 'es'}.`);
    } catch (error) {
      addHistoryRecord('partial', startedAt);
      updateExecutionState();
      renderHistory();
      setText(query(selectors.executionMessage), modules.core().errorMessage(error, 'Asset send rejected.'));
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
      assetType: state.preview.assetLabel || activeAssetLabel(),
      collection: state.token.name,
      token: state.token.symbol,
      tokenAddress: state.token.address,
      walletCount: plan.totalRecipients,
      totalTokens: state.preview.totalLabel || `${state.preview.totalFormatted} ${state.token.symbol}`,
      transferredIds: state.preview.recipients.map((recipient) => recipient.tokenId).filter(Boolean),
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

      const adapter = currentAdapter();

      if (!adapter) {
        throw new Error('Asset adapter unavailable.');
      }

      const totalRaw = modules.batcher().batchTotalRaw(failed);
      const totalFormatted = adapter.type === 'erc20'
        ? window.B20Wallet.formatUnits(totalRaw, state.token.decimals, 6)
        : String(failed.length);
      const totalLabel = adapter.type === 'erc20'
        ? `${totalFormatted} ${state.token.symbol}`
        : `${failed.length} failed transfer${failed.length === 1 ? '' : 's'}`;
      const plan = modules.batcher().buildPlan(failed, {
        unlimited: true,
        maxRecipients: maxRecipients(),
        safeBatchSize: safeBatchSize(),
        hardBatchSize: maxRecipients()
      });
      const retryParsed = {
        recipients: failed,
        totalRaw,
        totalFormatted,
        totalLabel
      };
      const senderStatus = await adapter.getReadiness({
        parsed: retryParsed,
        token: state.token,
        wallet: state.wallet,
        senderConfig: senderConfig(),
        assetSenderConfig: assetSenderConfig()
      });
      const approval = senderStatus.ready
        ? await adapter.readApprovalState({
            parsed: retryParsed,
            token: state.token,
            wallet: state.wallet,
            senderConfig: senderConfig(),
            assetSenderConfig: assetSenderConfig()
          })
        : { raw: '0', ready: false };

      state.preview = {
        ...state.preview,
        recipients: failed,
        totalRaw: totalRaw.toString(),
        totalFormatted,
        totalLabel,
        requiresApproval: Boolean(adapter.requiresApproval),
        allowanceRaw: approval.raw || '0',
        allowanceReady: Boolean(approval.ready),
        senderReady: Boolean(senderStatus.ready),
        senderMessage: senderStatus.message,
        plan
      };

      renderPreview();
      renderExecutionDetails();
      updateExecutionState();

      if (adapter.requiresApproval && !state.preview.allowanceReady) {
        setText(query(selectors.executionMessage), 'Failed-transfer retry prepared. Authorize exact retry amount before sending.');
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
      assetTokenIds: query(selectors.assetTokenIds)?.value || '',
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
    if (query(selectors.assetTokenIds)) {
      query(selectors.assetTokenIds).value = book.assetTokenIds || '';
    }
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
      const imported = modules.importer().normalizeImportText(text, state.importMode);
      query(selectors.recipients).value = imported.text.trim();
      resetTransactionState();

      if (state.importMode === 'csv') {
        const notes = [];
        notes.push(`${imported.addresses.toLocaleString('en-US')} addresses extracted`);

        if (imported.amountRows) {
          notes.push(`${imported.amountRows.toLocaleString('en-US')} rows include custom amounts`);
        } else {
          notes.push('fill Amount Per Wallet before validation');
        }

        if (imported.duplicatesRemoved) {
          notes.push(`${imported.duplicatesRemoved.toLocaleString('en-US')} duplicates removed`);
        }

        if (imported.invalidRows) {
          notes.push(`${imported.invalidRows.toLocaleString('en-US')} non-recipient rows ignored`);
        }

        setText(query(selectors.importMessage), `CSV normalized. ${notes.join('. ')}.`);
        return;
      }

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
      state.assetAdapter = null;
      resetTransactionState();
      renderTokenReadout();
    });
    bind(selectors.preview, 'click', validatePreview);
    bind(selectors.defaultAmount, 'input', resetTransactionState);
    bind(selectors.assetTokenIds, 'input', () => {
      showErrors([]);
      resetTransactionState();
    });
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
      appName: '0XB20 Asset Sender',
      appDescription: 'Universal Base asset distribution instrument.',
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
