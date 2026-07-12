(function (global) {
  const scanDuration = 5200;
  const lineDelay = 330;
  let config;
  let hooks = {};
  let isScanning = false;

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

  function sleep(duration) {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }

  function randomFrom(list, fallback) {
    if (!Array.isArray(list) || list.length === 0) {
      return fallback;
    }

    return list[Math.floor(Math.random() * list.length)];
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(value, 100));
  }

  async function typeTerminalLine(target, line) {
    const row = createElement('p', 'scanner-terminal-line');
    target.append(row);

    for (const character of `> ${line}`) {
      row.textContent += character;
      await sleep(12);
    }
  }

  function animateProgress(progress) {
    const startedAt = performance.now();

    function frame(now) {
      const percent = clampPercent(((now - startedAt) / scanDuration) * 100);
      progress.style.width = `${percent}%`;

      if (percent < 100) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  function findEasterEgg(host) {
    const lowered = host.toLowerCase();
    const eggs = config.easterEggs || {};
    const key = Object.keys(eggs).find((candidate) => lowered.includes(candidate));

    if (!key || Math.random() > 0.34) {
      return null;
    }

    return randomFrom(eggs[key], 'Unclassified signal detected.');
  }

  function maybeRareSecret() {
    if (!Array.isArray(config.rareSecrets) || Math.random() > 0.012) {
      return null;
    }

    return randomFrom(config.rareSecrets, 'UNKNOWN ENTITY DETECTED');
  }

  function buildReport(host) {
    const report = [
      ['Host Status', randomFrom(config.hostStatuses, 'Unknown')],
      ['Parasite Affinity', `${Math.floor(Math.random() * 101)}%`],
      ['Host Stability', randomFrom(config.hostStability, 'Questionable')],
      ['Risk Level', randomFrom(config.riskLevels, 'Medium')],
      ['Laboratory Recommendation', randomFrom(config.recommendations, 'Observe')]
    ];

    const rareMessage = Math.random() < 0.09 ? randomFrom(config.rareMessages, null) : null;
    const easterEgg = findEasterEgg(host);
    const rareSecret = maybeRareSecret();

    if (rareMessage) {
      report.push(['Archive Note', rareMessage]);
    }

    if (easterEgg) {
      report.push(['Hidden Response', easterEgg]);
    }

    if (rareSecret) {
      report.push(['Restricted Signal', rareSecret]);
    }

    return report;
  }

  function renderReport(target, rows) {
    const title = createElement('h3', '', 'Host Report');
    const list = createElement('div', 'scanner-report-grid');
    target.replaceChildren(title, list);

    rows.forEach(([labelText, valueText], index) => {
      const row = createElement('div', 'scanner-report-row');
      const label = createElement('span', 'scanner-report-label', labelText);
      const value = createElement('span', 'scanner-report-value', valueText);

      row.style.animationDelay = `${index * 75}ms`;
      row.append(label, value);
      list.append(row);
    });

    target.hidden = false;
  }

  async function runScan(elements) {
    const host = elements.input.value.trim();

    if (!host) {
      elements.panel.classList.add('scanner-shake');
      hooks.pushTerminalLine('Scanner rejected empty host signature');
      await sleep(420);
      elements.panel.classList.remove('scanner-shake');
      return;
    }

    isScanning = true;
    elements.button.disabled = true;
    elements.button.textContent = 'Scanning...';
    elements.report.hidden = true;
    elements.progress.style.width = '0%';
    elements.terminal.replaceChildren();
    elements.panel.classList.add('is-scanning');
    hooks.pushActivity({ title: 'Host scan initiated' });
    hooks.pushTerminalLine('Manual scanner process started');
    animateProgress(elements.progress);

    const steps = Array.isArray(config.steps) && config.steps.length > 0 ? config.steps : ['Finalizing report...'];

    for (const step of steps) {
      await typeTerminalLine(elements.terminal, step);
      await sleep(lineDelay);
    }

    await sleep(280);
    renderReport(elements.report, buildReport(host));
    hooks.pushActivity({ title: 'Host report finalized' });
    hooks.pushTerminalLine('Host report archived');
    elements.button.disabled = false;
    elements.button.textContent = 'Scan Host';
    elements.panel.classList.remove('is-scanning');
    isScanning = false;
  }

  function init(scannerConfig, terminalHooks) {
    const form = document.querySelector('[data-scanner-form]');
    const panel = document.querySelector('[data-scanner-panel]');
    const input = document.querySelector('[data-scanner-input]');
    const button = document.querySelector('[data-scanner-button]');
    const terminal = document.querySelector('[data-scanner-terminal]');
    const progress = document.querySelector('[data-scanner-progress]');
    const report = document.querySelector('[data-scanner-report]');

    if (!form || !panel || !input || !button || !terminal || !progress || !report) {
      return;
    }

    config = scannerConfig && typeof scannerConfig === 'object' ? scannerConfig : {};
    hooks = {
      pushActivity: terminalHooks && terminalHooks.pushActivity || function () {},
      pushTerminalLine: terminalHooks && terminalHooks.pushTerminalLine || function () {}
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!isScanning) {
        runScan({ button, input, panel, progress, report, terminal });
      }
    });
  }

  global.B20Scanner = {
    init
  };
})(window);
