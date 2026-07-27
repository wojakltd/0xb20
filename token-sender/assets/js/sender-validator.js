(function (global) {
  function ensureBaseWallet(walletState) {
    if (!walletState || !walletState.connected) {
      throw new Error('Connect wallet before continuing.');
    }

    if (!walletState.isBase) {
      throw new Error('Switch to Base before continuing.');
    }
  }

  function countCandidateLines(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^advanced:?$/i.test(line)).length;
  }

  global.B20SenderValidator = {
    ensureBaseWallet,
    countCandidateLines
  };
})(window);
