(function (global) {
  const core = global.B20SenderCore;

  function failedRows(plan) {
    return (plan?.batches || [])
      .filter((batch) => batch.status === 'failed')
      .flatMap((batch) => (batch.recipients || []).map((recipient) => ({
        ...recipient,
        batch: batch.number,
        error: batch.error || 'Batch failed'
      })));
  }

  function exportFailedTxt(token, plan) {
    const rows = failedRows(plan);

    if (!rows.length) {
      throw new Error('No failed wallets available for TXT export.');
    }

    const symbol = core.safeFilename(token?.symbol, 'TOKEN');
    core.download(`${symbol}_failed_wallets.txt`, 'text/plain', `${rows.map((row) => row.address).join('\n')}\n`);
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportFailedCsv(token, plan) {
    const rows = failedRows(plan);

    if (!rows.length) {
      throw new Error('No failed wallets available for CSV export.');
    }

    const content = [
      ['Batch', 'Address', 'Amount', 'Error'],
      ...rows.map((row) => [row.batch, row.address, row.amount, row.error])
    ].map((row) => row.map(csvCell).join(',')).join('\n');
    const symbol = core.safeFilename(token?.symbol, 'TOKEN');
    core.download(`${symbol}_failed_wallets.csv`, 'text/csv', `\uFEFF${content}\n`);
  }

  global.B20SenderExport = {
    failedRows,
    exportFailedTxt,
    exportFailedCsv
  };
})(window);
