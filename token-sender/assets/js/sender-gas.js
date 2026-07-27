(function (global) {
  function roughBatchGas(recipientCount) {
    return 70000 + Math.max(0, Number(recipientCount || 0)) * 62000;
  }

  function summarize(plan, measuredFirstBatchGas) {
    if (!plan || !plan.batches || !plan.batches.length) {
      return 'Unavailable';
    }

    const firstGas = measuredFirstBatchGas ? Number(measuredFirstBatchGas) : roughBatchGas(plan.batches[0].recipients.length);
    const roughTotal = firstGas + plan.batches.slice(1).reduce((total, batch) => total + roughBatchGas(batch.recipients.length), 0);

    return `${roughTotal.toLocaleString('en-US')} gas est. / ${plan.totalBatches} batch${plan.totalBatches === 1 ? '' : 'es'}`;
  }

  global.B20SenderGas = {
    roughBatchGas,
    summarize
  };
})(window);
