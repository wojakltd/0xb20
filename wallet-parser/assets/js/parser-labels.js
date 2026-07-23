(function () {
  const { addressKey, zeroAddress } = window.B20ParserUtils;

  const labelDefinitions = {
    CONTRACT: {
      value: 'CONTRACT',
      title: 'Smart contract holder'
    },
    BURN: {
      value: 'BURN',
      title: 'Burn or null holder'
    },
    LP: {
      value: 'LP',
      title: 'Liquidity pool'
    },
    ROUTER: {
      value: 'ROUTER',
      title: 'Router contract'
    },
    BRIDGE: {
      value: 'BRIDGE',
      title: 'Bridge contract'
    },
    SAFE: {
      value: 'SAFE',
      title: 'Safe wallet'
    },
    CEX: {
      value: 'CEX',
      title: 'Centralized exchange'
    },
    UNKNOWN: {
      value: 'UNKNOWN',
      title: 'Unclassified holder'
    }
  };

  const burnAddresses = new Set([
    zeroAddress,
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
    '0x000000000000000000000000000000000000dead'
  ].map(addressKey));

  function uniqueLabels(labels) {
    return Array.from(new Set((labels || []).filter(Boolean)));
  }

  function isBurnAddress(address) {
    return burnAddresses.has(addressKey(address));
  }

  function labelsForHolder(holder) {
    const labels = [];

    if (holder?.isContract) {
      labels.push(labelDefinitions.CONTRACT.value);
    }

    if (isBurnAddress(holder?.address)) {
      labels.push(labelDefinitions.BURN.value);
    }

    return uniqueLabels(labels);
  }

  function hasLabel(holder, label) {
    const expected = String(label || '').toUpperCase();
    return (holder?.labels || []).some((value) => String(value).toUpperCase() === expected);
  }

  function labelsText(holder) {
    return uniqueLabels(holder?.labels).join(' / ');
  }

  window.B20ParserLabels = {
    labelDefinitions,
    isBurnAddress,
    labelsForHolder,
    hasLabel,
    labelsText
  };
})();
