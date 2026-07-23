(function () {
  const accessPassword = '0xb20.lol';
  const accessGateEnabled = true;
  const pageSize = 100;

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
    sort: '[data-parser-sort]',
    sortDir: '[data-parser-sort-dir]',
    copy: '[data-parser-copy]',
    table: '[data-parser-holder-table]',
    count: '[data-parser-count]',
    pagination: '[data-parser-pagination]',
    loaded: '[data-parser-loaded]',
    range: '[data-parser-range]',
    pageLabel: '[data-parser-page-label]',
    previous: '[data-parser-prev]',
    next: '[data-parser-next]',
    exportTxt: '[data-parser-export-txt]',
    exportCsv: '[data-parser-export-csv]',
    exportReport: '[data-parser-export-report]',
    filterPanel: '[data-parser-filter-panel]',
    filterToggle: '[data-parser-filter-toggle]',
    applyFilters: '[data-parser-apply-filters]',
    resetFilters: '[data-parser-reset-filters]'
  };

  const provider = new window.B20BlockscoutProvider.BlockscoutProvider({
    maxHolders: pageSize
  });
  const scanner = new window.B20HolderParser.WalletHolderScanner(provider);
  const utils = window.B20ParserUtils;
  const copy = window.B20ParserCopy;
  const exporter = window.B20ParserExport;
  const filters = window.B20ParserFilters;
  const pagination = new window.B20ParserPagination.ParserPagination(pageSize);

  const state = {
    initialized: false,
    token: null,
    holders: [],
    filteredHolders: [],
    visibleHolders: [],
    activeFilters: filters.defaultFilters(),
    searchTerm: '',
    sortKey: 'rank',
    sortDirection: 'asc',
    currentPageIndex: 0,
    moreAvailable: false,
    nextPageParams: null,
    meta: null,
    loadingMore: false,
    exporting: false
  };

  function query(selector) {
    return document.querySelector(selector);
  }

  function stat(name) {
    return document.querySelector(`[data-parser-stat="${name}"]`);
  }

  function exportStat(name) {
    return document.querySelector(`[data-parser-export-stat="${name}"]`);
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

    renderPaginationControls();
  }

  function setExportReport(hidden) {
    const report = query(selectors.exportReport);

    if (report) {
      report.hidden = hidden;
    }
  }

  function updateExportReport(stats = {}) {
    setExportReport(false);
    setText(exportStat('pages'), String(stats.pagesLoaded ?? 0));
    setText(exportStat('wallets'), String(stats.walletsLoaded ?? state.holders.length));
    setText(exportStat('exported'), String(stats.walletsExported ?? 0));
    setText(exportStat('duplicates'), String(stats.duplicatesRemoved ?? 0));
    setText(exportStat('filteredOut'), String(stats.filteredOut ?? 0));
    setText(exportStat('elapsed'), stats.elapsed || '--');
    setText(exportStat('provider'), stats.provider || provider.label);
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

  function estimatedHolderCount() {
    const estimate = Number(state.token?.holdersCount);
    return Number.isFinite(estimate) && estimate > 0 ? estimate : null;
  }

  function loadedLabel() {
    const estimate = estimatedHolderCount();
    const loaded = state.holders.length.toLocaleString('en-US');

    return estimate ? `Loaded ${loaded} / ${estimate.toLocaleString('en-US')}` : `Loaded ${loaded} / --`;
  }

  function visibleRangeLabel() {
    const range = pagination.range(state.currentPageIndex, state.filteredHolders.length);
    const estimate = estimatedHolderCount();
    const hasUserFilter = hasActiveFilters() || Boolean(state.searchTerm);
    const total = !hasUserFilter && estimate && estimate > range.total ? estimate : range.total;

    return `Showing ${range.start.toLocaleString('en-US')}–${range.end.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`;
  }

  function currentPageLabel() {
    return `Page ${state.currentPageIndex + 1}`;
  }

  function hasActiveFilters() {
    const config = state.activeFilters || filters.defaultFilters();
    return Boolean(
      config.hideContracts ||
      config.minBalanceRaw !== null ||
      config.maxBalanceRaw !== null ||
      config.minSupply !== null ||
      config.maxSupply !== null ||
      config.address
    );
  }

  function renderStats() {
    const loaded = state.holders.length;
    const filtered = state.filteredHolders.length;
    const hidden = Math.max(0, loaded - filtered);
    const visible = state.visibleHolders.length;
    const contract = state.token ? state.token.address : '--';

    setText(stat('loaded'), String(loaded));
    setText(stat('filtered'), String(filtered));
    setText(stat('hidden'), String(hidden));
    setText(stat('visible'), String(visible));
    setText(stat('page'), currentPageLabel());
    setText(stat('contractFilter'), state.activeFilters.hideContracts ? 'ON' : 'OFF');
    setText(stat('source'), provider.label);
    setText(stat('contract'), contract);
    setText(query(selectors.count), `${visible} VISIBLE`);

    const copyButton = query(selectors.copy);
    const exportTxtButton = query(selectors.exportTxt);
    const exportCsvButton = query(selectors.exportCsv);

    if (copyButton) {
      copyButton.disabled = visible === 0 || state.exporting || scanner.isActive();
    }

    if (exportTxtButton) {
      exportTxtButton.disabled = visible === 0 || state.exporting || scanner.isActive();
      exportTxtButton.textContent = state.exporting ? 'Exporting...' : 'Download TXT';
    }

    if (exportCsvButton) {
      exportCsvButton.disabled = visible === 0 || state.exporting || scanner.isActive();
      exportCsvButton.textContent = state.exporting ? 'Exporting...' : 'Download CSV';
    }

    renderPaginationControls();
  }

  function renderPaginationControls() {
    const previousButton = query(selectors.previous);
    const nextButton = query(selectors.next);
    const loaded = query(selectors.loaded);
    const range = query(selectors.range);
    const pageLabel = query(selectors.pageLabel);
    const paginationMessage = query(selectors.pagination);
    const hasCachedNext = state.currentPageIndex < Math.ceil(state.filteredHolders.length / pageSize) - 1;
    const canLoadNext = Boolean(state.token && (hasCachedNext || state.moreAvailable));

    setText(loaded, loadedLabel());
    setText(pageLabel, currentPageLabel());
    setText(range, visibleRangeLabel());
    setText(paginationMessage, `${loadedLabel()}. ${currentPageLabel()}. ${visibleRangeLabel()}.`);

    if (previousButton) {
      previousButton.disabled = state.loadingMore || state.exporting || state.currentPageIndex <= 0;
    }

    if (nextButton) {
      nextButton.disabled = state.loadingMore || state.exporting || !canLoadNext;
      nextButton.textContent = state.loadingMore ? 'Loading next page...' : 'Load Next 100';
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
    ['Rank', 'Address', 'Balance', 'Supply %', 'Actions'].forEach((label) => {
      header.appendChild(createCell(label));
    });
    return header;
  }

  function createHolderRow(holder, index) {
    const row = document.createElement('div');
    row.className = 'parser-holder-row';

    const rank = createCell(String(holder.rank || index + 1), 'parser-holder-rank');

    const addressCell = document.createElement('div');
    addressCell.className = 'parser-holder-address';

    const short = document.createElement('strong');
    short.className = 'parser-address-short';
    short.textContent = utils.shortAddress(holder.address);
    short.title = holder.address;
    addressCell.appendChild(short);

    (holder.labels || []).forEach((labelName) => {
      const label = document.createElement('span');
      const normalizedLabel = String(labelName).toLowerCase();
      label.className = `parser-label is-${normalizedLabel}`;
      label.textContent = labelName;
      label.title = labelName === 'CONTRACT' && holder.label ? holder.label : `${labelName} holder`;
      addressCell.appendChild(label);
    });

    const balance = createCell(`${holder.balance} ${state.token ? state.token.symbol : ''}`.trim());
    const percentage = createCell(holder.percentage);

    const actions = document.createElement('div');
    actions.className = 'parser-row-actions';

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

    const externalLink = document.createElement('a');
    externalLink.className = 'parser-external-link';
    externalLink.href = typeof provider.addressUrl === 'function' ? provider.addressUrl(holder.address) : `https://base.blockscout.com/address/${holder.address}`;
    externalLink.target = '_blank';
    externalLink.rel = 'noopener noreferrer';
    externalLink.textContent = '↗';
    externalLink.title = 'Open in Blockscout';

    actions.append(copyButton, externalLink);
    row.append(rank, addressCell, balance, percentage, actions);
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
      empty.textContent = state.holders.length ? 'No loaded holders match the active filters.' : 'No holders loaded yet.';
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

  function compareBigInt(left, right) {
    if (left === right) {
      return 0;
    }

    return left > right ? 1 : -1;
  }

  function sortHolders(holders) {
    const direction = state.sortDirection === 'desc' ? -1 : 1;
    const key = state.sortKey;

    return [...holders].sort((left, right) => {
      let result = 0;

      if (key === 'balance') {
        result = compareBigInt(BigInt(String(left.valueRaw || '0')), BigInt(String(right.valueRaw || '0')));
      } else if (key === 'supply') {
        result = Number(left.percentageValue || 0) - Number(right.percentageValue || 0);
      } else {
        result = Number(left.rank || 0) - Number(right.rank || 0);
      }

      if (result === 0) {
        result = Number(left.rank || 0) - Number(right.rank || 0);
      }

      return result * direction;
    });
  }

  function filteredSortedHolders(holders) {
    let filteredHolders = filters.applyFilters(holders, state.activeFilters);

    if (state.searchTerm) {
      filteredHolders = filteredHolders.filter((holder) => holder.address.toLowerCase().includes(state.searchTerm));
    }

    return sortHolders(filteredHolders);
  }

  function applyView(options = {}) {
    const preservePage = Boolean(options.preservePage);
    state.filteredHolders = filteredSortedHolders(state.holders);

    if (!preservePage) {
      state.currentPageIndex = 0;
    }

    state.currentPageIndex = pagination.clampPage(state.currentPageIndex, state.filteredHolders.length);
    state.visibleHolders = pagination.pageItems(state.filteredHolders, state.currentPageIndex);
    renderHolders();
  }

  function applySearch() {
    const input = query(selectors.search);
    state.searchTerm = input ? input.value.trim().toLowerCase() : '';
    applyView();
  }

  function resetResult() {
    state.token = null;
    state.holders = [];
    state.filteredHolders = [];
    state.visibleHolders = [];
    state.activeFilters = filters.defaultFilters();
    state.searchTerm = '';
    state.sortKey = 'rank';
    state.sortDirection = 'asc';
    state.currentPageIndex = 0;
    state.moreAvailable = false;
    state.nextPageParams = null;
    state.meta = null;
    state.loadingMore = false;
    state.exporting = false;
    setExportReport(true);

    const searchInput = query(selectors.search);
    if (searchInput) {
      searchInput.value = '';
    }

    filters.resetControls(query(selectors.filterPanel));
    resetSortControls();
    renderTokenReadout(null);
    renderHolders();
    renderStats();
  }

  function errorMessage(error, fallback) {
    if (error && error.name === 'AbortError') {
      return 'Operation cancelled.';
    }

    return error instanceof Error && error.message ? error.message : fallback;
  }

  function assignRanks() {
    state.holders = state.holders.map((holder, index) => ({
      ...holder,
      rank: index + 1
    }));
  }

  function mergeHolders(incomingHolders) {
    const seen = new Set(state.holders.map((holder) => utils.addressKey(holder.address)));

    (incomingHolders || []).forEach((holder) => {
      const key = utils.addressKey(holder.address);

      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      state.holders.push(holder);
    });

    assignRanks();
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
      state.meta = result.meta;
      state.moreAvailable = Boolean(result.meta.moreAvailable);
      state.nextPageParams = result.meta.nextPageParams || null;
      mergeHolders(result.holders);

      renderTokenReadout(state.token);
      applyView();
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

  async function loadNextPage() {
    if (!state.token || scanner.isActive() || state.loadingMore || state.exporting) {
      return;
    }

    const cachedPageCount = Math.ceil(state.filteredHolders.length / pageSize);

    if (state.currentPageIndex < cachedPageCount - 1) {
      state.currentPageIndex += 1;
      applyView({ preservePage: true });
      return;
    }

    if (!state.moreAvailable) {
      setMessage('No additional indexed holders available.');
      renderPaginationControls();
      return;
    }

    state.loadingMore = true;
    setBusy(true);
    setParserState('LOADING');
    setMessage('Loading next holder page...');
    setProgress(8, 'Requesting next indexed holder page...');

    try {
      const previousPageIndex = state.currentPageIndex;
      const result = await scanner.loadPage(state.token.address, state.token, state.nextPageParams, {
        onProgress: ({ value, text }) => setProgress(value, text)
      });

      state.meta = result.meta;
      state.moreAvailable = Boolean(result.meta.moreAvailable);
      state.nextPageParams = result.meta.nextPageParams || null;
      mergeHolders(result.holders);
      state.currentPageIndex = previousPageIndex + 1;
      applyView({ preservePage: true });
      setParserState('READY');
      setMessage(result.holders.length ? `Loaded next holder page. ${state.holders.length} total holders cached.` : 'Provider returned an empty page.');
    } catch (error) {
      setParserState(error && error.name === 'AbortError' ? 'CANCELLED' : 'ERROR');
      setMessage(errorMessage(error, 'Unable to load next holder page.'));
    } finally {
      state.loadingMore = false;
      setBusy(false);
      hideProgress();
      renderPaginationControls();
    }
  }

  function loadPreviousPage() {
    if (state.currentPageIndex <= 0 || state.loadingMore) {
      return;
    }

    state.currentPageIndex -= 1;
    applyView({ preservePage: true });
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

  function exportProgressLabel(walletsLoaded, expectedTotal) {
    const loaded = Number(walletsLoaded || 0).toLocaleString('en-US');

    if (expectedTotal) {
      return `${loaded} / ${Number(expectedTotal).toLocaleString('en-US')}`;
    }

    return loaded;
  }

  function exportElapsed(startedAt) {
    return utils.formatDuration(Date.now() - startedAt);
  }

  async function prepareGlobalExport(type) {
    if (!state.token || scanner.isActive() || state.exporting) {
      return null;
    }

    const startedAt = Date.now();
    const typeLabel = type.toUpperCase();
    let pagesLoaded = 0;
    let duplicatesRemoved = 0;
    let partialError = '';

    state.exporting = true;
    setBusy(true);
    setParserState('EXPORTING');
    setMessage(`Loading all available provider holders before ${typeLabel} export...`);
    setProgress(6, 'Loading holders...');
    updateExportReport({
      pagesLoaded,
      walletsLoaded: state.holders.length,
      walletsExported: 0,
      duplicatesRemoved,
      filteredOut: 0,
      elapsed: exportElapsed(startedAt),
      provider: provider.label
    });

    try {
      if (state.moreAvailable) {
        const result = await scanner.loadAllPages(state.token.address, state.token, state.nextPageParams, state.holders, {
          expectedTotal: estimatedHolderCount(),
          startPageNumber: Math.floor(state.holders.length / pageSize) + 1,
          onProgress: ({ value, text }) => setProgress(value, text),
          onExportProgress: (progress) => {
            pagesLoaded = progress.pagesLoaded || pagesLoaded;
            duplicatesRemoved = progress.duplicatesRemoved || duplicatesRemoved;
            setProgress(Math.min(90, 8 + pagesLoaded), progress.message || 'Loading holders...');
            setMessage(`${progress.message || 'Loading holders...'} ${exportProgressLabel(progress.walletsLoaded, progress.expectedTotal)}`);
            updateExportReport({
              pagesLoaded,
              walletsLoaded: progress.walletsLoaded || state.holders.length,
              walletsExported: 0,
              duplicatesRemoved,
              filteredOut: 0,
              elapsed: exportElapsed(startedAt),
              provider: progress.provider || provider.label
            });
          }
        });

        state.meta = result.meta;
        state.moreAvailable = Boolean(result.meta.moreAvailable);
        state.nextPageParams = result.meta.nextPageParams || null;
        partialError = result.meta.partialError || '';
        pagesLoaded = result.meta.pagesLoaded || pagesLoaded;
        duplicatesRemoved = result.meta.duplicatesRemoved || duplicatesRemoved;
        mergeHolders(result.holders);
      }

      applyView({ preservePage: true });

      const exportHolders = filteredSortedHolders(state.holders);
      const filteredOut = Math.max(0, state.holders.length - exportHolders.length);

      updateExportReport({
        pagesLoaded,
        walletsLoaded: state.holders.length,
        walletsExported: exportHolders.length,
        duplicatesRemoved,
        filteredOut,
        elapsed: exportElapsed(startedAt),
        provider: provider.label
      });

      setProgress(96, `Preparing ${typeLabel}...`);

      return {
        holders: exportHolders,
        partialError,
        startedAt
      };
    } catch (error) {
      setParserState(error && error.name === 'AbortError' ? 'CANCELLED' : 'ERROR');
      setMessage(errorMessage(error, `${typeLabel} export unavailable.`));
      return null;
    }
  }

  async function finishGlobalExport(type, action) {
    const typeLabel = type.toUpperCase();
    const prepared = await prepareGlobalExport(type);

    if (!prepared) {
      state.exporting = false;
      setBusy(false);
      hideProgress();
      renderStats();
      return;
    }

    try {
      action(prepared.holders);
      setProgress(100, `${typeLabel} export ready.`);
      setParserState(prepared.partialError ? 'PARTIAL' : 'READY');
      setMessage(prepared.partialError
        ? `${typeLabel} export generated from available provider data. Provider stopped early: ${prepared.partialError}`
        : `${typeLabel} export generated for ${prepared.holders.length.toLocaleString('en-US')} available holders.`);
    } catch (error) {
      setParserState('ERROR');
      setMessage(errorMessage(error, `${typeLabel} export unavailable.`));
    } finally {
      state.exporting = false;
      setBusy(false);
      hideProgress();
      updateExportReport({
        pagesLoaded: state.meta?.pagesLoaded || 0,
        walletsLoaded: state.holders.length,
        walletsExported: prepared.holders.length,
        duplicatesRemoved: state.meta?.duplicatesRemoved || 0,
        filteredOut: Math.max(0, state.holders.length - prepared.holders.length),
        elapsed: exportElapsed(prepared.startedAt),
        provider: provider.label
      });
      renderStats();
    }
  }

  function exportTxt() {
    finishGlobalExport('txt', (holders) => exporter.exportTxt(state.token, holders));
  }

  function exportCsv() {
    finishGlobalExport('csv', (holders) => exporter.exportCsv(state.token, holders));
  }

  function toggleFilterPanel() {
    const panel = query(selectors.filterPanel);
    const toggle = query(selectors.filterToggle);

    if (!panel) {
      return;
    }

    panel.hidden = !panel.hidden;

    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
      toggle.textContent = panel.hidden ? 'Open Filters' : 'Close Filters';
    }
  }

  function applyAdvancedFilters() {
    try {
      setMessage('Applying filters...');
      state.activeFilters = filters.readFilters(query(selectors.filterPanel), state.token);
      applyView();
      setMessage(`${state.filteredHolders.length} holders match active filters.`);
    } catch (error) {
      setMessage(errorMessage(error, 'Invalid filter settings.'));
    }
  }

  function resetAdvancedFilters() {
    filters.resetControls(query(selectors.filterPanel));

    const searchInput = query(selectors.search);
    if (searchInput) {
      searchInput.value = '';
    }

    state.activeFilters = filters.defaultFilters();
    state.searchTerm = '';
    applyView();
    setMessage('Filters reset.');
  }

  function resetSortControls() {
    const sortInput = query(selectors.sort);
    const sortDirectionButton = query(selectors.sortDir);

    if (sortInput) {
      sortInput.value = state.sortKey;
    }

    if (sortDirectionButton) {
      sortDirectionButton.textContent = state.sortDirection.toUpperCase();
      sortDirectionButton.setAttribute('aria-label', `Sort direction ${state.sortDirection}`);
    }
  }

  function applySort() {
    const sortInput = query(selectors.sort);
    state.sortKey = sortInput ? sortInput.value : 'rank';
    applyView();
    setMessage(`Sorted by ${state.sortKey}.`);
  }

  function toggleSortDirection() {
    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    resetSortControls();
    applyView({ preservePage: true });
    setMessage(`Sort direction ${state.sortDirection.toUpperCase()}.`);
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

    const bindings = [
      [selectors.scan, 'click', startScan],
      [selectors.cancel, 'click', cancelScan],
      [selectors.search, 'input', applySearch],
      [selectors.sort, 'change', applySort],
      [selectors.sortDir, 'click', toggleSortDirection],
      [selectors.copy, 'click', copyVisibleAddresses],
      [selectors.previous, 'click', loadPreviousPage],
      [selectors.next, 'click', loadNextPage],
      [selectors.exportTxt, 'click', exportTxt],
      [selectors.exportCsv, 'click', exportCsv],
      [selectors.filterToggle, 'click', toggleFilterPanel],
      [selectors.applyFilters, 'click', applyAdvancedFilters],
      [selectors.resetFilters, 'click', resetAdvancedFilters]
    ];

    bindings.forEach(([selector, eventName, handler]) => {
      const element = query(selector);
      if (element) {
        element.addEventListener(eventName, handler);
      }
    });
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
