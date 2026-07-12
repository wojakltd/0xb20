(function (global) {
  let logs = [];
  let activeFilter = 'all';
  let searchInput;
  let listTarget;
  let filterTarget;

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

  function matchesSearch(log, query) {
    if (!query) {
      return true;
    }

    const haystack = [
      log.title,
      log.summary,
      log.content,
      log.type,
      ...log.tags
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  function matchesFilter(log) {
    if (activeFilter === 'all') {
      return true;
    }

    return log.type === activeFilter || log.tags.includes(activeFilter);
  }

  function collapseOtherCards(currentCard) {
    listTarget.querySelectorAll('.archive-card.is-expanded').forEach((card) => {
      if (card !== currentCard) {
        card.classList.remove('is-expanded');
        card.querySelector('button').setAttribute('aria-expanded', 'false');
      }
    });
  }

  function renderTags(tags) {
    const list = createElement('div', 'archive-tags');

    tags.forEach((tag) => {
      list.append(createElement('span', 'archive-tag', tag));
    });

    return list;
  }

  function renderLogCard(log) {
    const card = createElement('article', 'archive-card');
    const button = createElement('button', 'archive-card-toggle');
    const header = createElement('div', 'archive-card-header');
    const titleGroup = createElement('div');
    const number = createElement('span', 'log-kicker', `LOG #${log.logNumber} / ${log.type}`);
    const title = createElement('h2', '', log.title);
    const date = createElement('time', 'log-date', formatDate(log.date));
    const summary = createElement('p', 'archive-summary', log.summary);
    const content = createElement('div', 'archive-content');
    const contentText = createElement('p', '', log.content);

    date.setAttribute('datetime', log.date);
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    titleGroup.append(number, title);
    header.append(titleGroup, date);
    content.append(contentText, renderTags(log.tags));
    button.append(header, summary);
    card.append(button, content);

    button.addEventListener('click', () => {
      const willExpand = !card.classList.contains('is-expanded');
      collapseOtherCards(card);
      card.classList.toggle('is-expanded', willExpand);
      button.setAttribute('aria-expanded', String(willExpand));
    });

    return card;
  }

  function renderUnavailable() {
    listTarget.replaceChildren(createElement('p', 'archive-empty', 'Laboratory Archive unavailable.'));
  }

  function renderLogs() {
    const query = searchInput.value.trim().toLowerCase();
    const visibleLogs = logs.filter((log) => matchesFilter(log) && matchesSearch(log, query));

    if (logs.unavailable) {
      renderUnavailable();
      return;
    }

    if (visibleLogs.length === 0) {
      listTarget.replaceChildren(createElement('p', 'archive-empty', 'No archived specimens matched this request.'));
      return;
    }

    listTarget.replaceChildren(...visibleLogs.map(renderLogCard));
  }

  function bindFilters() {
    filterTarget.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-filter]');

      if (!button) {
        return;
      }

      activeFilter = button.dataset.filter;
      filterTarget.querySelectorAll('button').forEach((filterButton) => {
        filterButton.setAttribute('aria-pressed', String(filterButton === button));
      });
      renderLogs();
    });
  }

  async function init() {
    const data = global.B20Data;
    const ui = global.B20UI;

    searchInput = document.querySelector('[data-log-search]');
    listTarget = document.querySelector('[data-log-list]');
    filterTarget = document.querySelector('[data-log-filters]');

    if (!data || !searchInput || !listTarget || !filterTarget) {
      return;
    }

    if (ui) {
      ui.initReveal();
    }

    logs = await data.loadLogs();
    searchInput.addEventListener('input', renderLogs);
    bindFilters();
    renderLogs();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
