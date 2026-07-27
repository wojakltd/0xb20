(function (global) {
  const core = global.B20SenderCore;

  function batchTotalRaw(recipients) {
    return (recipients || []).reduce((total, recipient) => total + BigInt(recipient.amountRaw || 0), 0n);
  }

  function buildPlan(recipients, options = {}) {
    const maxRecipients = Number(options.maxRecipients || 250);
    const unlimited = Boolean(options.unlimited);
    const safeBatchSize = Math.max(1, Math.min(
      Number(options.safeBatchSize || 120),
      Number(options.hardBatchSize || maxRecipients || 250)
    ));
    const list = Array.isArray(recipients) ? recipients : [];

    if (!unlimited && list.length > maxRecipients) {
      throw new Error(`Batch exceeds ${maxRecipients} recipients. Unlimited Batch Sending requires Lab Pass.`);
    }

    const batches = core.chunk(list, unlimited ? safeBatchSize : Math.min(maxRecipients, safeBatchSize)).map((items, index) => ({
      index,
      number: index + 1,
      recipients: items,
      totalRaw: batchTotalRaw(items).toString(),
      status: 'pending',
      txHash: '',
      error: ''
    }));

    return {
      unlimited,
      safeBatchSize,
      totalRecipients: list.length,
      totalBatches: batches.length,
      batches
    };
  }

  function failedRecipients(plan) {
    return (plan?.batches || [])
      .filter((batch) => batch.status === 'failed')
      .flatMap((batch) => batch.recipients || []);
  }

  function successfulRecipients(plan) {
    return (plan?.batches || [])
      .filter((batch) => batch.status === 'confirmed')
      .flatMap((batch) => batch.recipients || []);
  }

  global.B20SenderBatcher = {
    buildPlan,
    batchTotalRaw,
    failedRecipients,
    successfulRecipients
  };
})(window);
