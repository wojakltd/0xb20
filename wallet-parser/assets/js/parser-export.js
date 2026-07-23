(function () {
  const labels = window.B20ParserLabels;

  function safeFilename(value, fallback) {
    const text = String(value || '').trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
    return text || fallback;
  }

  function download(filename, mimeType, content) {
    const blob = new Blob([content], {
      type: `${mimeType};charset=utf-8`
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportTxt(token, holders) {
    const addresses = (holders || []).map((holder) => holder.address).filter(Boolean);

    if (!addresses.length) {
      throw new Error('No visible addresses available for TXT export.');
    }

    const symbol = safeFilename(token?.symbol, 'TOKEN');
    download(`${symbol}_holders.txt`, 'text/plain', `${addresses.join('\n')}\n`);
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportCsv(token, holders) {
    if (!holders || !holders.length) {
      throw new Error('No visible holders available for CSV export.');
    }

    const rows = [
      ['Rank', 'Address', 'Balance', 'Supply %', 'Labels'],
      ...holders.map((holder) => [
        holder.rank,
        holder.address,
        holder.balance,
        holder.percentage,
        labels.labelsText(holder)
      ])
    ];
    const content = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const symbol = safeFilename(token?.symbol, 'TOKEN');

    download(`${symbol}_holders.csv`, 'text/csv', `\uFEFF${content}\n`);
  }

  window.B20ParserExport = {
    exportTxt,
    exportCsv
  };
})();
