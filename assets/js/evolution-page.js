(function (global) {
  const terminalLineDelay = 170;
  let expandedPhase = null;

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

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clampProgress(value) {
    const number = Number(value);
    return Math.max(0, Math.min(Number.isFinite(number) ? number : 0, 100));
  }

  function sleep(duration) {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }

  function renderUnavailable() {
    const page = document.querySelector('.evolution-page');
    const message = createElement('section', 'terminal-panel evolution-unavailable');
    message.append(
      createElement('span', 'eyebrow', 'EVOLUTION OFFLINE'),
      createElement('p', 'panel-loading', 'Laboratory Evolution unavailable.')
    );

    if (page) {
      page.replaceChildren(message);
    }
  }

  function phaseClass(phase) {
    if (phase.state === 'completed') {
      return 'is-completed';
    }

    if (phase.state === 'current') {
      return 'is-current';
    }

    return 'is-future';
  }

  function phaseMarker(phase) {
    if (phase.state === 'completed') {
      return '✓';
    }

    if (phase.state === 'current') {
      return '▶';
    }

    return '○';
  }

  function objectiveMarker(objective) {
    if (objective.active) {
      return '▶';
    }

    return objective.done ? '✓' : '□';
  }

  function renderHero(evolution) {
    const target = document.querySelector('[data-evolution-hero]');
    const hero = evolution.hero || {};
    const progress = clampProgress(hero.progress);

    if (!target) {
      return;
    }

    const title = createElement('h1', '', hero.title || 'LABORATORY EVOLUTION');
    const subtitle = createElement('p', 'evolution-subtitle', hero.subtitle || 'The experiment grows through public research.');
    const secondary = createElement('p', 'evolution-secondary', hero.secondary || 'Research never ends.');
    const progressWrap = createElement('div', 'evolution-hero-progress');
    const label = createElement('span', '', `${hero.progressLabel || 'Current Progress'}:`);
    const value = createElement('strong', '', `${progress}%`);
    const shell = createElement('div', 'progress-shell evolution-progress-shell');
    const fill = createElement('div', 'progress-fill evolution-progress-fill');

    fill.style.setProperty('--evolution-progress', `${progress}%`);
    shell.append(fill);
    progressWrap.append(label, value, shell);
    target.replaceChildren(title, subtitle, secondary, progressWrap);
  }

  function setExpanded(card, shouldExpand) {
    const button = card.querySelector('.evolution-phase-toggle');
    const content = card.querySelector('.evolution-phase-panel');

    if (button) {
      button.setAttribute('aria-expanded', String(shouldExpand));
    }

    if (!content) {
      card.classList.toggle('is-expanded', shouldExpand);
      return;
    }

    if (shouldExpand) {
      card.classList.add('is-expanded');
      content.style.maxHeight = `${content.scrollHeight + 40}px`;

      content.addEventListener('transitionend', function unlockHeight(event) {
        if (event.propertyName !== 'max-height') {
          return;
        }

        if (card.classList.contains('is-expanded')) {
          content.style.maxHeight = 'none';
        }
      }, { once: true });

      return;
    }

    if (content.style.maxHeight === 'none') {
      content.style.maxHeight = `${content.scrollHeight}px`;
    }

    content.getBoundingClientRect();
    card.classList.remove('is-expanded');

    requestAnimationFrame(() => {
      content.style.maxHeight = '0px';
    });
  }

  function expandOnly(card) {
    if (expandedPhase && expandedPhase !== card) {
      setExpanded(expandedPhase, false);
    }

    const shouldExpand = !card.classList.contains('is-expanded');
    setExpanded(card, shouldExpand);
    expandedPhase = shouldExpand ? card : null;
  }

  function renderObjective(objective) {
    const source = typeof objective === 'object' && objective ? objective : { text: String(objective) };
    const item = createElement('li', 'evolution-objective');

    item.append(
      createElement('span', 'evolution-objective-marker', objectiveMarker(source)),
      createElement('span', '', source.text || '')
    );

    if (source.active) {
      item.classList.add('is-active');
    }

    return item;
  }

  function renderPhase(phase) {
    const card = createElement('article', `evolution-phase ${phaseClass(phase)}`);
    const contentId = `evolution-phase-${phase.id}`;
    const button = createElement('button', 'evolution-phase-toggle');
    const marker = createElement('span', 'evolution-phase-marker', phaseMarker(phase));
    const text = createElement('span', 'evolution-phase-text');
    const title = createElement('span', 'evolution-phase-title', phase.title || 'UNCLASSIFIED');
    const summary = createElement('span', 'evolution-phase-summary', phase.summary || 'Research in progress.');
    const panel = createElement('div', 'evolution-phase-panel');
    const goalBlock = createElement('div', 'evolution-phase-block');
    const objectivesBlock = createElement('div', 'evolution-phase-block');
    const objectives = createElement('ul', 'evolution-objectives');

    text.append(title, summary);
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', contentId);
    button.append(marker, text);

    goalBlock.append(
      createElement('span', 'evolution-panel-label', 'Goal'),
      createElement('p', '', phase.goal || 'Research continues.')
    );

    asArray(phase.objectives).forEach((objective) => {
      objectives.append(renderObjective(objective));
    });

    objectivesBlock.append(
      createElement('span', 'evolution-panel-label', 'Objectives'),
      objectives
    );

    panel.id = contentId;
    panel.append(goalBlock, objectivesBlock);
    button.addEventListener('click', () => expandOnly(card));
    card.append(button, panel);

    return card;
  }

  function renderTree(evolution) {
    const target = document.querySelector('[data-evolution-tree]');
    const phases = asArray(evolution.phases);

    if (!target) {
      return;
    }

    const tree = createElement('div', 'evolution-tree');
    const cards = phases.map(renderPhase);

    cards.forEach((card, index) => {
      tree.append(card);

      if (index < cards.length - 1) {
        tree.append(createElement('div', 'evolution-connector', '↓'));
      }
    });

    target.replaceChildren(tree);

    const currentCard = cards.find((card) => card.classList.contains('is-current')) || cards[0];

    if (currentCard) {
      setExpanded(currentCard, true);
      expandedPhase = currentCard;
    }
  }

  function renderTelemetry(evolution) {
    const target = document.querySelector('[data-evolution-telemetry]');
    const telemetry = evolution.telemetry || {};
    const progress = clampProgress(telemetry.progress);

    if (!target) {
      return;
    }

    const heading = createElement('div', 'section-heading compact');
    const list = createElement('div', 'status-list');

    heading.append(
      createElement('span', 'eyebrow', 'Mission Control'),
      createElement('h2', '', telemetry.title || 'LAB STATUS')
    );

    asArray(telemetry.fields).forEach((field) => {
      const row = createElement('div', 'status-row');
      const label = createElement('span', 'status-label', field.label || '');
      const value = createElement('span', field.state === 'online' ? 'status-value is-online' : 'status-value', field.value || '');

      row.append(label, value);

      if (field.progress) {
        const shell = createElement('div', 'progress-shell');
        const fill = createElement('div', 'progress-fill evolution-progress-fill');
        fill.style.setProperty('--evolution-progress', `${progress}%`);
        shell.append(fill);
        row.append(shell);
      }

      list.append(row);
    });

    target.replaceChildren(heading, list);
  }

  async function typeTerminalLines(target, lines) {
    const reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.replaceChildren();

    for (const line of lines) {
      const row = createElement('p', 'terminal-line');
      row.textContent = `> ${line}`;
      target.append(row);

      if (!reducedMotion) {
        await sleep(terminalLineDelay);
      }
    }

    target.append(createElement('span', 'console-cursor evolution-terminal-cursor'));
  }

  function renderTerminal(evolution) {
    const target = document.querySelector('[data-evolution-terminal]');
    const terminal = evolution.terminal || {};
    const heading = createElement('div', 'evolution-terminal-heading');
    const output = createElement('div', 'evolution-terminal-output');

    if (!target) {
      return;
    }

    heading.append(
      createElement('span', 'eyebrow', 'System Output'),
      createElement('h2', '', terminal.title || 'STATUS REPORT')
    );

    target.replaceChildren(heading, output);
    typeTerminalLines(output, asArray(terminal.lines));
  }

  async function init() {
    const data = global.B20Data;
    const ui = global.B20UI;

    if (ui) {
      ui.initReveal();
    }

    if (!data || !data.loadEvolution) {
      renderUnavailable();
      return;
    }

    const evolution = await data.loadEvolution();

    if (!evolution) {
      renderUnavailable();
      return;
    }

    renderHero(evolution);
    renderTree(evolution);
    renderTelemetry(evolution);
    renderTerminal(evolution);

    if (ui) {
      ui.initReveal();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
