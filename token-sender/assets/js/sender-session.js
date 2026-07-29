(function (global) {
  const storage = global.B20SenderStorage;

  function snapshotFromDom(selectors) {
    const tokenInput = document.querySelector(selectors.tokenAddress);
    const amountInput = document.querySelector(selectors.defaultAmount);
    const recipientsInput = document.querySelector(selectors.recipients);
    const tokenIdsInput = selectors.assetTokenIds ? document.querySelector(selectors.assetTokenIds) : null;

    return {
      tokenAddress: tokenInput ? tokenInput.value : '',
      defaultAmount: amountInput ? amountInput.value : '',
      recipientsText: recipientsInput ? recipientsInput.value : '',
      assetTokenIds: tokenIdsInput ? tokenIdsInput.value : ''
    };
  }

  function save(selectors, extra = {}) {
    storage.saveSession({
      ...snapshotFromDom(selectors),
      ...extra
    });
  }

  function restore(selectors) {
    const session = storage.readSession();

    if (!session) {
      return null;
    }

    const tokenInput = document.querySelector(selectors.tokenAddress);
    const amountInput = document.querySelector(selectors.defaultAmount);
    const recipientsInput = document.querySelector(selectors.recipients);
    const tokenIdsInput = selectors.assetTokenIds ? document.querySelector(selectors.assetTokenIds) : null;

    if (tokenInput && session.tokenAddress) {
      tokenInput.value = session.tokenAddress;
    }

    if (amountInput && session.defaultAmount) {
      amountInput.value = session.defaultAmount;
    }

    if (recipientsInput && session.recipientsText) {
      recipientsInput.value = session.recipientsText;
    }

    if (tokenIdsInput && session.assetTokenIds) {
      tokenIdsInput.value = session.assetTokenIds;
    }

    return session;
  }

  global.B20SenderSession = {
    save,
    restore
  };
})(window);
