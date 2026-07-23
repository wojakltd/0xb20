(function () {
  const { zeroAddress, parseDecimalToRaw } = window.B20ParserUtils;
  const labels = window.B20ParserLabels;

  function defaultFilters() {
    return {
      hideContracts: false,
      hideBurn: true,
      hideZero: true,
      minBalanceRaw: null,
      maxBalanceRaw: null,
      minSupply: null,
      maxSupply: null,
      address: ''
    };
  }

  function readNumber(value, label) {
    const text = String(value || '').trim().replace(/,/g, '');

    if (!text) {
      return null;
    }

    if (!/^\d+(\.\d+)?$/.test(text)) {
      throw new Error(`${label} must be a valid number.`);
    }

    return Number(text);
  }

  function readFilters(root, token) {
    const filters = defaultFilters();

    if (!root) {
      return filters;
    }

    filters.hideContracts = Boolean(root.querySelector('[data-parser-filter="hide-contracts"]')?.checked);
    filters.hideBurn = Boolean(root.querySelector('[data-parser-filter="hide-burn"]')?.checked);
    filters.hideZero = Boolean(root.querySelector('[data-parser-filter="hide-zero"]')?.checked);
    filters.address = String(root.querySelector('[data-parser-filter="address"]')?.value || '').trim().toLowerCase();

    const minBalance = root.querySelector('[data-parser-filter="min-balance"]')?.value;
    const maxBalance = root.querySelector('[data-parser-filter="max-balance"]')?.value;
    const minSupply = root.querySelector('[data-parser-filter="min-supply"]')?.value;
    const maxSupply = root.querySelector('[data-parser-filter="max-supply"]')?.value;

    filters.minBalanceRaw = parseDecimalToRaw(minBalance, token?.decimals || 18);
    filters.maxBalanceRaw = parseDecimalToRaw(maxBalance, token?.decimals || 18);
    filters.minSupply = readNumber(minSupply, 'Minimum supply percentage');
    filters.maxSupply = readNumber(maxSupply, 'Maximum supply percentage');

    if (filters.minBalanceRaw !== null && filters.maxBalanceRaw !== null && filters.minBalanceRaw > filters.maxBalanceRaw) {
      throw new Error('Minimum balance cannot be greater than maximum balance.');
    }

    if (filters.minSupply !== null && filters.maxSupply !== null && filters.minSupply > filters.maxSupply) {
      throw new Error('Minimum supply percentage cannot be greater than maximum supply percentage.');
    }

    return filters;
  }

  function applyFilters(holders, filters) {
    const config = {
      ...defaultFilters(),
      ...filters
    };

    return (holders || []).filter((holder) => {
      const address = String(holder.address || '').toLowerCase();
      const balanceRaw = BigInt(String(holder.valueRaw || '0'));
      const supply = Number(holder.percentageValue || 0);

      if (config.hideContracts && labels.hasLabel(holder, 'CONTRACT')) {
        return false;
      }

      if (config.hideZero && address === zeroAddress) {
        return false;
      }

      if (config.hideBurn && labels.hasLabel(holder, 'BURN')) {
        return false;
      }

      if (config.minBalanceRaw !== null && balanceRaw < config.minBalanceRaw) {
        return false;
      }

      if (config.maxBalanceRaw !== null && balanceRaw > config.maxBalanceRaw) {
        return false;
      }

      if (config.minSupply !== null && supply < config.minSupply) {
        return false;
      }

      if (config.maxSupply !== null && supply > config.maxSupply) {
        return false;
      }

      if (config.address && !address.includes(config.address)) {
        return false;
      }

      return true;
    });
  }

  function resetControls(root) {
    if (!root) {
      return;
    }

    const values = {
      'hide-contracts': false,
      'hide-burn': true,
      'hide-zero': true
    };

    Object.entries(values).forEach(([name, checked]) => {
      const input = root.querySelector(`[data-parser-filter="${name}"]`);
      if (input) {
        input.checked = checked;
      }
    });

    ['min-balance', 'max-balance', 'min-supply', 'max-supply', 'address'].forEach((name) => {
      const input = root.querySelector(`[data-parser-filter="${name}"]`);
      if (input) {
        input.value = '';
      }
    });
  }

  window.B20ParserFilters = {
    defaultFilters,
    readFilters,
    applyFilters,
    resetControls
  };
})();
