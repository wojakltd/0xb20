(function (global) {
  const utils = global.B20PremiumUtils;

  function wallet() {
    if (!global.B20Wallet) {
      throw new Error('Wallet layer unavailable.');
    }
    return global.B20Wallet;
  }

  function licenseActiveData(account) {
    return `${utils.selectors.isLicenseActive}${utils.padAddress(account)}`;
  }

  function licenseExpirationData(account) {
    return `${utils.selectors.licenseExpiration}${utils.padAddress(account)}`;
  }

  function assertConfigured(config) {
    if (!utils.isConfigured(config)) {
      throw new Error('Lab Pass contract is not configured yet.');
    }
  }

  async function requireDeployedContract(config) {
    assertConfigured(config);
    const code = await wallet().readContractCode(config.contractAddress);

    if (!code || code === '0x') {
      throw new Error('Lab Pass contract not found on selected network.');
    }
  }

  async function readLicense(config, account) {
    assertConfigured(config);

    const service = wallet();
    const [activeRaw, expirationRaw] = await Promise.all([
      service.callContract(config.contractAddress, licenseActiveData(account)),
      service.callContract(config.contractAddress, licenseExpirationData(account))
    ]);

    const expiration = Number(utils.decodeUint256(expirationRaw));

    return {
      active: utils.decodeBool(activeRaw),
      expiration,
      expiresAtLabel: utils.formatDate(expiration)
    };
  }

  async function approveExactPayment(config, account, onProgress) {
    assertConfigured(config);

    if (utils.isNativePayment(config)) {
      if (typeof onProgress === 'function') {
        onProgress('Native ETH payment requires no token approval.');
      }
      return null;
    }

    const service = wallet();
    const priceRaw = BigInt(config.priceRaw || 0);
    const allowanceRaw = BigInt(await service.readTokenAllowance(
      config.paymentToken.address,
      account,
      config.contractAddress
    ));

    if (allowanceRaw >= priceRaw) {
      return null;
    }

    if (typeof onProgress === 'function') {
      onProgress(`Requesting exact ${config.paymentToken.symbol || 'ERC-20'} approval...`);
    }

    const hash = await service.requestTokenApproval(
      config.paymentToken.address,
      config.contractAddress,
      priceRaw.toString()
    );
    const receipt = await service.waitForTransactionReceipt(hash, { timeoutMs: 240000 });

    if (receipt && receipt.status === '0x0') {
      throw new Error(`${config.paymentToken.symbol || 'ERC-20'} approval failed.`);
    }

    return hash;
  }

  async function purchaseLicense(config, onProgress) {
    assertConfigured(config);

    if (typeof onProgress === 'function') {
      onProgress('Activating Lab Pass...');
    }

    const service = wallet();
    const hash = await service.sendTransaction({
      to: config.contractAddress,
      data: utils.selectors.purchase,
      value: utils.isNativePayment(config) ? utils.toHexValue(config.priceRaw) : '0x0'
    });
    const receipt = await service.waitForTransactionReceipt(hash, { timeoutMs: 240000 });

    if (receipt && receipt.status === '0x0') {
      throw new Error('Lab Pass purchase failed.');
    }

    return hash;
  }

  global.B20PremiumContract = {
    requireDeployedContract,
    readLicense,
    approveExactPayment,
    purchaseLicense
  };
})(window);
