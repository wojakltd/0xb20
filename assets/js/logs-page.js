(function (global) {
  let listTarget;

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function formatDate(dateString) {
    if (!dateString) {
      return 'Date unknown';
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return 'Date unknown';
    }

    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  function renderEntry(log) {
    const entry = createElement('article', 'archive-terminal-entry');
    const meta = createElement('p', 'archive-terminal-meta', `> ${log.entryLabel} / ${formatDate(log.date)}`);
    const title = createElement('h2', '', log.title);
    const body = createElement('p', 'archive-terminal-body', log.content);

    entry.append(meta, title, body);
    return entry;
  }

  function renderLogs(logs) {
    if (logs.unavailable) {
      listTarget.replaceChildren(createElement('p', 'archive-empty', 'Laboratory Archive unavailable.'));
      return;
    }

    if (!logs.length) {
      listTarget.replaceChildren(createElement('p', 'archive-empty', 'No laboratory records found.'));
      return;
    }

    listTarget.replaceChildren(...logs.map(renderEntry));
  }

  async function init() {
    const data = global.B20Data;
    const ui = global.B20UI;

    listTarget = document.querySelector('[data-log-list]');

    if (!data || !listTarget) {
      return;
    }

    if (ui) {
      ui.initReveal();
    }

    renderLogs(await data.loadLogs());
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
