(function () {
  const accessPassword = '0xb20.lol';
  const accessGateEnabled = true;

  const selectors = {
    tokenAddress: '[data-parser-token-address]',
    scan: '[data-parser-scan]',
    cancel: '[data-parser-cancel]',
    state: '[data-parser-state]',
    message: '[data-parser-message]',
    progress: '[data-parser-progress]',
    progressFill: '[data-parser-progress-fill]',
    progressText: '[data-parser-progress-text]',
    tokenReadout: '[data-parser-token-readout]',
    search: '[data-parser-search]',
    copy: '[data-parser-copy]',
    table: '[data-parser-holder-table]',
    count: '[data-parser-count]',
    pagination: '[data-parser-pagination]'
  };

  const provider = new window.B20BlockscoutProvider.BlockscoutProvider();
  const scanner = new window.B20HolderParser.WalletHolderScanner(provider);
  const utils = window.B20ParserUtils;
  const copy = window.B20ParserCopy;

  const state = {
    initialized: false,
    token: null,
    holders: [],
    visibleHolders: [],
    meta: null
  };

  function query(selector) {
    return document.querySelector(selector);
  }

  function stat(name) {
    return document.querySelector(`[data-parser-stat="${name}"]`);
  }

  function setText(target, value) {
    if (target) {
      target.textContent = value;
    }
  }

  function setMessage(message) {
    setText(query(selectors.message), message);
  }

  function setParserState(value) {
    setText(query(selectors.state), value);
  }

  function setBusy(isBusy) {
    const scanButton = query(selectors.scan);
    const cancelButton = query(selectors.cancel);
    const tokenInput = query(selectors.tokenAddress);

    if (scanButton) {
      scanButton.disabled = isBusy;
    }

    if (cancelButton) {
      cancelButton.disabled = !isBusy;
    }

    if (tokenInput) {
      tokenInput.disabled = isBusy;
    }
  }

  function setProgress(value, text) {
    const progress = query(selectors.progress);
    const fill = query(selectors.progressFill);
    const label = query(selectors.progressText);

    if (progress) {
      progress.hidden = false;
    }

    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
    }

    if (label) {
      label.textContent = text || 'Scanning...';
    }
  }

  function hideProgress() {
    const progress = query(selectors.progress);

    if (progress) {
      progress.hidden = true;
    }
  }

  function renderTokenReadout(token) {
    const target = query(selectors.tokenReadout);

    if (!target) {
      return;
    }

    const values = token ? [
      `Name: ${token.name}`,
      `Symbol: ${token.symbol}`,
      `Decimals: ${token.decimals}`,
      `Total Supply: ${token.totalSupply}`,
      `Estimated Holders: ${token.holdersCount || '--'}`,
      `Network: ${provider.network}`,
      `Source: ${provider.label}`,
      `Contract: ${utils.shortAddress(token.address)}`
    ] : [
      'Name: --',
      'Symbol: --',
      'Decimals: --',
      'Total Supply: --',
      'Estimated Holders: --',
      `Network: ${provider.network}`,
      `Source: ${provider.label}`,
      'Contract: --'
    ];

    target.innerHTML = '';

    values.forEach((value) => {
      const item = document.createElement('span');
      item.textContent = value;
      target.appendChild(item);
    });
  }

  function renderStats() {
    const displayed = state.visibleHolders.length;
    const found = state.holders.length;
    const duration = state.meta ? utils.formatDuration(state.meta.durationMs) : '--';
    const updated = state.meta ? new Date(state.meta.lastUpdated).toLocaleString() : '--';
    const contract = state.token ? state.token.address : '--';

    setText(stat('found'), String(found));
    setText(stat('displayed'), String(displayed));
    setText(stat('duration'), duration);
    setText(stat('source'), provider.label);
    setText(stat('updated'), updated);
    setText(stat('contract'), contract);
    setText(query(selectors.count), `${found} FOUND`);

    const copyButton = query(selectors.copy);
    if (copyButton) {
      copyButton.disabled = displayed === 0;
    }

    const pagination = query(selectors.pagination);
    if (pagination) {
      pagination.hidden = !(state.meta && state.meta.moreAvailable);
    }
  }

  function createCell(text, className) {
    const cell = document.createElement('div');
    cell.textContent = text;

    if (className) {
      cell.className = className;
    }

    return cell;
  }

  function createHeader() {
    const header = document.createElement('div');
    header.className = 'parser-holder-header';
    ['Rank', 'Address', 'Balance', 'Supply', 'Copy'].forEach((label) => {
      header.appendChild(createCell(label));
    });
    return header;
  }

  function createHolderRow(holder, index) {
    const row = document.createElement('div');
    row.className = 'parser-holder-row';

    const rank = createCell(String(index + 1), 'parser-holder-rank');

    const addressCell = document.createElement('div');
    addressCell.className = 'parser-holder-address';

    const short = document.createElement('strong');
    short.className = 'parser-address-short';
    short.textContent = utils.shortAddress(holder.address);
    short.title = holder.address;
    addressCell.appendChild(short);

    if (holder.isContract) {
      const label = document.createElement('span');
      label.className = 'parser-label is-contract';
      label.textContent = holder.label ? `Contract: ${holder.label}` : 'Contract';
      label.title = holder.label || 'Smart contract holder';
      addressCell.appendChild(label);
    }

    const balance = createCell(`${holder.balance} ${state.token ? state.token.symbol : ''}`.trim());
    const percentage = createCell(holder.percentage);

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'parser-copy-button';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', async () => {
      try {
        await copy.copyLines([holder.address]);
        setMessage(`Copied ${holder.address}`);
      } catch (error) {
        setMessage(errorMessage(error, 'Copy unavailable.'));
      }
    });

    row.append(rank, addressCell, balance, percentage, copyButton);
    return row;
  }

  function renderHolders() {
    const table = query(selectors.table);

    if (!table) {
      return;
    }

    table.innerHTML = '';

    if (!state.visibleHolders.length) {
      const empty = document.createElement('p');
      empty.className = 'parser-empty';
      empty.textContent = state.holders.length ? 'No loaded holders match this search.' : 'No holders loaded yet.';
      table.appendChild(empty);
      renderStats();
      return;
    }

    table.appendChild(createHeader());
    state.visibleHolders.forEach((holder, index) => {
      table.appendChild(createHolderRow(holder, index));
    });

    renderStats();
  }

  function applySearch() {
    const input = query(selectors.search);
    const term = input ? input.value.trim().toLowerCase() : '';

    if (!term) {
      state.visibleHolders = [...state.holders];
    } else {
      state.visibleHolders = state.holders.filter((holder) => holder.address.toLowerCase().includes(term));
    }

    renderHolders();
  }

  function resetResult() {
    state.token = null;
    state.holders = [];
    state.visibleHolders = [];
    state.meta = null;

    renderTokenReadout(null);
    renderHolders();
    renderStats();
  }

  function errorMessage(error, fallback) {
    if (error && error.name === 'AbortError') {
      return 'Scan cancelled.';
    }

    return error instanceof Error && error.message ? error.message : fallback;
  }

  async function startScan() {
    if (scanner.isActive()) {
      return;
    }

    const input = query(selectors.tokenAddress);
    const address = input ? input.value.trim() : '';

    resetResult();

    if (!utils.isAddress(address)) {
      setParserState('REJECTED');
      setMessage('Invalid contract address.');
      if (input) {
        input.focus();
      }
      return;
    }

    setBusy(true);
    setParserState('SCANNING');
    setMessage('Reading Base holder data...');
    setProgress(4, 'Starting protected holder scan...');

    try {
      const result = await scanner.scan(address, {
        onProgress: ({ value, text }) => setProgress(value, text)
      });

      state.token = result.token;
      state.holders = result.holders;
      state.visibleHolders = [...result.holders];
      state.meta = result.meta;

      renderTokenReadout(state.token);
      renderHolders();
      setParserState('READY');
      setMessage(`Scan complete. ${state.holders.length} useful holder wallets loaded from ${provider.label}.`);
    } catch (error) {
      setParserState(error && error.name === 'AbortError' ? 'CANCELLED' : 'ERROR');
      setMessage(errorMessage(error, 'Wallet parser failed.'));
      renderError(errorMessage(error, 'Wallet parser failed.'));
    } finally {
      setBusy(false);
      hideProgress();
    }
  }

  function renderError(message) {
    const table = query(selectors.table);

    if (!table) {
      return;
    }

    table.innerHTML = '';
    const error = document.createElement('p');
    error.className = 'parser-error';
    error.textContent = message;
    table.appendChild(error);
    renderStats();
  }

  function cancelScan() {
    scanner.cancel();
  }

  async function copyVisibleAddresses() {
    try {
      const addresses = state.visibleHolders.map((holder) => holder.address);
      await copy.copyLines(addresses);
      setMessage(`Copied ${addresses.length} visible addresses.`);
    } catch (error) {
      setMessage(errorMessage(error, 'Copy unavailable.'));
    }
  }

  function initParser() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    if (window.B20UI && typeof window.B20UI.initReveal === 'function') {
      window.B20UI.initReveal();
    }

    setParserState('WAITING');
    renderTokenReadout(null);
    renderHolders();
    renderStats();

    const scanButton = query(selectors.scan);
    const cancelButton = query(selectors.cancel);
    const searchInput = query(selectors.search);
    const copyButton = query(selectors.copy);

    if (scanButton) {
      scanButton.addEventListener('click', startScan);
    }

    if (cancelButton) {
      cancelButton.addEventListener('click', cancelScan);
    }

    if (searchInput) {
      searchInput.addEventListener('input', applySearch);
    }

    if (copyButton) {
      copyButton.addEventListener('click', copyVisibleAddresses);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.B20AccessGate) {
      initParser();
      return;
    }

    window.B20AccessGate.init({
      enabled: accessGateEnabled,
      password: accessPassword,
      storageKey: 'b20-wallet-parser-access',
      gateSelector: '[data-parser-gate]',
      contentSelector: '[data-parser-content]',
      formSelector: '[data-parser-gate-form]',
      inputSelector: '[data-parser-password]',
      errorSelector: '[data-parser-gate-error]',
      onUnlock: initParser
    });
  });
})();
