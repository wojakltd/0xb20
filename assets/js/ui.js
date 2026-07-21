(function (global) {
  const bootLineDelay = 140;
  const bootCharacterDelay = 18;

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

  function getTodayKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${now.getFullYear()}-${month}-${day}`;
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

  function formatLastUpdate(status, latestLog, researchFeed) {
    if (status && status.lastUpdate && status.lastUpdate !== 'auto') {
      return status.lastUpdate;
    }

    const latestObservationAt = researchFeed
      && researchFeed.metadata
      && researchFeed.metadata.latestObservationAt;

    if (latestObservationAt) {
      const observationDate = new Date(latestObservationAt);

      if (!Number.isNaN(observationDate.getTime())) {
        const observationKey = [
          observationDate.getFullYear(),
          String(observationDate.getMonth() + 1).padStart(2, '0'),
          String(observationDate.getDate()).padStart(2, '0')
        ].join('-');

        return observationKey === getTodayKey() ? 'Today' : formatDate(observationKey);
      }
    }

    if (!latestLog || !latestLog.date) {
      return 'Research in progress';
    }

    return latestLog.date === getTodayKey() ? 'Today' : formatDate(latestLog.date);
  }

  function sleep(duration) {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }

  async function typeLine(target, line) {
    for (const character of line) {
      target.textContent += character;
      await sleep(bootCharacterDelay);
    }

    target.textContent += '\n';
    await sleep(bootLineDelay);
  }

  async function runBootSequence(lines) {
    const boot = document.getElementById('boot-screen');
    const target = document.getElementById('boot-text');

    if (!boot || !target) {
      return;
    }

    // The boot screen runs independently from data loading so the lab never feels frozen.
    target.classList.add('boot-cursor');

    for (const line of lines) {
      await typeLine(target, `> ${line}`);
    }

    target.classList.remove('boot-cursor');
    await sleep(280);
    boot.classList.add('is-finished');
    await sleep(900);
    boot.remove();
  }

  function initReveal() {
    const targets = document.querySelectorAll('[data-reveal]');

    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });

    targets.forEach((target) => observer.observe(target));
  }

  function animateCounter(target) {
    const finalValue = Number(target.dataset.countTarget);
    const suffix = target.dataset.countSuffix || '';

    if (!Number.isFinite(finalValue)) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      target.textContent = `${finalValue}${suffix}`;
      return;
    }

    const startedAt = performance.now();
    const duration = 1100;

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(finalValue * eased);

      target.textContent = `${value}${suffix}`;

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    }

    target.textContent = `0${suffix}`;
    window.requestAnimationFrame(tick);
  }

  function initCounters() {
    const targets = document.querySelectorAll('[data-count-target]');

    if (!targets.length) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      targets.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.counted === 'true') {
          return;
        }

        entry.target.dataset.counted = 'true';
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    targets.forEach((target) => observer.observe(target));
  }

  function renderLatestLog(log) {
    const target = document.querySelector('[data-latest-log]');

    if (!target) {
      return;
    }

    if (!log) {
      target.replaceChildren(
        createElement('span', 'log-kicker', 'ARCHIVE OFFLINE'),
        createElement('p', 'log-body', 'Laboratory Archive unavailable.')
      );
      return;
    }

    const header = createElement('div', 'log-header');
    const titleGroup = createElement('div');
    const kicker = createElement('span', 'log-kicker', `${log.entryLabel} / ${log.type}`);
    const title = createElement('h3', '', log.title);
    const date = createElement('time', 'log-date', formatDate(log.date));
    const body = createElement('p', 'log-body', log.summary);
    const archiveLink = createElement('a', 'log-link', 'Open Legacy Archive');

    date.setAttribute('datetime', log.date);
    archiveLink.href = global.B20LabConfig && global.B20LabConfig.routes ? global.B20LabConfig.routes.logs : 'logs/';
    titleGroup.append(kicker, title);
    header.append(titleGroup, date);
    target.replaceChildren(header, body, archiveLink);
  }

  function renderActivity(activity) {
    const target = document.querySelector('[data-activity-feed]');

    if (!target) {
      return;
    }

    const items = activity.map((entry) => {
      const item = createElement('div', 'activity-item');
      const time = createElement('span', 'activity-time', entry.time);
      const title = createElement('span', 'activity-title', entry.title);

      item.append(time, title);
      return item;
    });

    target.replaceChildren(...items);
  }

  function renderStatus(status, latestLog, researchFeed) {
    const target = document.querySelector('[data-system-status]');

    if (!target) {
      return;
    }

    const progress = Number(status.developmentProgress) || 0;
    const fields = [
      ['Laboratory Status', status.laboratoryStatus, 'is-online'],
      ['Current Experiment', status.currentExperiment],
      ['Development Progress', `${progress}%`],
      ['Current Network', status.currentNetwork],
      ['Current Holders', status.currentHosts],
      ['Last Update', formatLastUpdate(status, latestLog, researchFeed)]
    ];

    const rows = fields.map(([labelText, valueText, stateClass]) => {
      const row = createElement('div', 'status-row');
      const label = createElement('span', 'status-label', labelText);
      const value = createElement('span', `status-value ${stateClass || ''}`.trim(), valueText);

      row.append(label, value);

      if (labelText === 'Development Progress') {
        const shell = createElement('div', 'progress-shell');
        const fill = createElement('div', 'progress-fill');
        fill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
        shell.append(fill);
        row.append(shell);
      }

      return row;
    });

    target.replaceChildren(...rows);
  }

  global.B20UI = {
    initCounters,
    initReveal,
    renderActivity,
    renderLatestLog,
    renderStatus,
    runBootSequence
  };
})(window);
