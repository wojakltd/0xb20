(function (global) {
  function entryText(entry) {
    const preview = global.B20AiPreview;
    return entry.text || preview.formatPayload(entry.payload, entry.type || entry.mode || 'signal') || 'Stored Laboratory output';
  }

  function renderList(target, items, emptyText, type, search = '') {
    if (!target) {
      return;
    }

    const query = String(search || '').trim().toLowerCase();
    const filtered = query
      ? items.filter((item) => entryText(item).toLowerCase().includes(query) || String(item.type || '').toLowerCase().includes(query))
      : items;

    target.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-memory-empty';
      empty.textContent = emptyText;
      target.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-memory-item';
      button.dataset.aiAction = 'restore';
      button.dataset.aiRestoreType = type;
      button.dataset.aiRestoreId = item.id || item.savedAt || item.text;
      button.textContent = `${String(item.type || type).toUpperCase()} ${entryText(item)}`.slice(0, 360);
      target.appendChild(button);
    });
  }

  global.B20AiRenderHistory = {
    renderList,
    entryText
  };
})(window);
