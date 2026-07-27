(function (global) {
  function render(target, progress) {
    if (!target) {
      return;
    }

    const totalBatches = Math.max(1, Number(progress.totalBatches || 1));
    const completedBatches = Math.max(0, Number(progress.completedBatches || 0));
    const totalWallets = Math.max(0, Number(progress.totalWallets || 0));
    const completedWallets = Math.max(0, Number(progress.completedWallets || 0));
    const percent = totalWallets
      ? Math.min(100, Math.round((completedWallets / totalWallets) * 100))
      : Math.min(100, Math.round((completedBatches / totalBatches) * 100));

    target.hidden = false;
    target.innerHTML = `
      <div class="sender-progress-head">
        <strong>${progress.label || 'Distribution progress'}</strong>
        <span>${percent}%</span>
      </div>
      <div class="sender-progress-track" aria-hidden="true">
        <span style="width:${percent}%"></span>
      </div>
      <div class="sender-progress-meta">
        <span>Batch ${Math.min(completedBatches + 1, totalBatches)} / ${totalBatches}</span>
        <span>${completedWallets} / ${totalWallets} wallets</span>
        <span>ETA ${progress.eta || '--'}</span>
      </div>
    `;
  }

  function reset(target) {
    if (target) {
      target.hidden = true;
      target.replaceChildren();
    }
  }

  global.B20SenderProgress = {
    render,
    reset
  };
})(window);
