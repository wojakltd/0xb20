(function (global) {
  const storage = global.B20SenderStorage;

  function snapshotFromDom(selectors) {
    const tokenInput = document.querySelector(selectors.tokenAddress);
    const amountInput = document.querySelector(selectors.defaultAmount);
    const recipientsInput = document.querySelector(selectors.recipients);

    return {
      tokenAddress: tokenInput ? tokenInput.value : '',
      defaultAmount: amountInput ? amountInput.value : '',
      recipientsText: recipientsInput ? recipientsInput.value : ''
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

    if (tokenInput && session.tokenAddress) {
      tokenInput.value = session.tokenAddress;
    }

    if (amountInput && session.defaultAmount) {
      amountInput.value = session.defaultAmount;
    }

    if (recipientsInput && session.recipientsText) {
      recipientsInput.value = session.recipientsText;
    }

    return session;
  }

  global.B20SenderSession = {
    save,
    restore
  };
})(window);
