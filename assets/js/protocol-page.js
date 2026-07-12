(function (global) {
  const terminalLineDelay = 260;
  const terminalCharacterDelay = 14;
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
    const page = document.querySelector('.protocol-page');
    const message = createElement('section', 'terminal-panel protocol-unavailable');
    message.append(
      createElement('span', 'eyebrow', 'PROTOCOL OFFLINE'),
      createElement('p', 'panel-loading', 'Laboratory Evolution Protocol unavailable.')
    );

    if (page) {
      page.replaceChildren(message);
    }
  }

  function renderHero(protocol) {
    const target = document.querySelector('[data-protocol-hero]');
    const hero = protocol.hero || {};

    if (!target) {
      return;
    }

    target.className = 'protocol-hero';
    target.replaceChildren();

    const eyebrow = createElement('span', 'eyebrow', hero.eyebrow || 'CLASSIFIED PROTOCOL');
    const title = createElement('h1', '', hero.title || 'LABORATORY EVOLUTION PROTOCOL');
    const subtitle = createElement('p', 'subtitle', hero.subtitle || 'Research never ends.');
    const status = createElement('span', 'protocol-status', hero.status || 'ACTIVE');

    target.append(eyebrow, title, subtitle, status);
  }

  function renderIntroduction(protocol) {
    const target = document.querySelector('[data-protocol-introduction]');
    const intro = protocol.introduction || {};

    if (!target) {
      return;
    }

    target.className = 'protocol-intro terminal-panel';
    target.replaceChildren();

    const heading = createElement('div', 'section-heading');
    heading.append(
      createElement('span', 'eyebrow', intro.eyebrow || 'Protocol Briefing'),
      createElement('h2', '', intro.title || 'Internal Research Document')
    );

    const paragraphs = asArray(intro.paragraphs).map((text) => createElement('p', '', text));
    const studiesTitle = createElement('p', 'protocol-study-title', intro.studiesTitle || 'The Laboratory studies:');
    const studies = createElement('div', 'protocol-study-grid');

    asArray(intro.studies).forEach((study) => {
      studies.append(createElement('span', 'protocol-study', study));
    });

    target.append(heading, ...paragraphs, studiesTitle, studies);
  }

  function setExpanded(card, shouldExpand) {
    const button = card.querySelector('.protocol-phase-toggle');
    const content = card.querySelector('.protocol-phase-content');

    card.classList.toggle('is-expanded', shouldExpand);

    if (button) {
      button.setAttribute('aria-expanded', String(shouldExpand));
    }

    if (content) {
      content.style.maxHeight = shouldExpand ? `${content.scrollHeight}px` : '0px';
    }
  }

  function expandOnly(card) {
    if (expandedPhase && expandedPhase !== card) {
      setExpanded(expandedPhase, false);
    }

    const shouldExpand = !card.classList.contains('is-expanded');
    setExpanded(card, shouldExpand);
    expandedPhase = shouldExpand ? card : null;
  }

  function renderObjective(phase, objective) {
    const item = createElement('li', 'protocol-objective');
    const marker = phase.completed ? '✓' : '☐';

    item.append(
      createElement('span', 'protocol-objective-marker', marker),
      createElement('span', '', String(objective))
    );

    return item;
  }

  function renderPhase(phase) {
    const card = createElement('article', 'protocol-phase');
    const contentId = `protocol-phase-${phase.id}`;
    const button = createElement('button', 'protocol-phase-toggle');
    const marker = createElement('span', 'protocol-phase-node');
    const header = createElement('span', 'protocol-phase-header');
    const titleGroup = createElement('span', 'protocol-phase-title-group');
    const eyebrow = createElement('span', 'protocol-phase-eyebrow', `PHASE ${phase.id}`);
    const title = createElement('span', 'protocol-phase-title', phase.title || 'UNCLASSIFIED PHASE');
    const status = createElement('span', 'protocol-phase-status', phase.status || 'UNDER OBSERVATION');
    const subtitle = createElement('span', 'protocol-phase-subtitle', phase.subtitle || '');
    const content = createElement('div', 'protocol-phase-content');
    const description = createElement('p', '', phase.description || 'Research in progress.');
    const objectivesTitle = createElement('h4', '', 'Objectives');
    const objectives = createElement('ul', 'protocol-objectives');
    const notes = createElement('p', 'protocol-phase-notes', phase.notes || '');

    if (phase.completed) {
      card.classList.add('is-completed');
    }

    if (phase.current) {
      card.classList.add('is-current');
    }

    titleGroup.append(eyebrow, title, subtitle);
    header.append(titleGroup, status);
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', contentId);
    button.append(marker, header);

    asArray(phase.objectives).forEach((objective) => {
      objectives.append(renderObjective(phase, objective));
    });

    content.id = contentId;
    content.append(description, objectivesTitle, objectives);

    if (notes.textContent) {
      content.append(notes);
    }

    button.addEventListener('click', () => expandOnly(card));
    card.append(button, content);

    return card;
  }

  function renderTimeline(protocol) {
    const target = document.querySelector('[data-protocol-timeline]');
    const timeline = protocol.timeline || {};
    const phases = asArray(protocol.phases);

    if (!target) {
      return;
    }

    target.className = 'protocol-timeline-shell archive-shell';
    target.replaceChildren();

    const heading = createElement('div', 'section-heading');
    heading.append(
      createElement('span', 'eyebrow', timeline.eyebrow || 'Evolution Trace'),
      createElement('h2', '', timeline.title || 'Protocol Timeline'),
      createElement('p', '', timeline.description || 'Research determines what survives.')
    );

    const list = createElement('div', 'protocol-timeline');
    const cards = phases.map(renderPhase);

    list.append(...cards);
    target.append(heading, list);

    const currentCard = cards.find((card) => card.classList.contains('is-current')) || cards[0];

    if (currentCard) {
      setExpanded(currentCard, true);
      expandedPhase = currentCard;
    }
  }

  function renderTelemetry(protocol) {
    const target = document.querySelector('[data-protocol-telemetry]');
    const telemetry = protocol.telemetry || {};
    const progress = clampProgress(telemetry.progress);

    if (!target) {
      return;
    }

    target.className = 'protocol-telemetry terminal-panel';
    target.replaceChildren();

    const heading = createElement('div', 'section-heading compact');
    const list = createElement('div', 'status-list');

    heading.append(
      createElement('span', 'eyebrow', telemetry.eyebrow || 'Live Telemetry'),
      createElement('h2', '', telemetry.title || 'LABORATORY STATUS')
    );

    asArray(telemetry.fields).forEach((field) => {
      const row = createElement('div', 'status-row');
      const label = createElement('span', 'status-label', field.label || '');
      const value = createElement('span', field.state === 'online' ? 'status-value is-online' : 'status-value', field.value || '');

      row.append(label, value);

      if (field.progress) {
        const shell = createElement('div', 'progress-shell');
        const fill = createElement('div', 'progress-fill protocol-progress-fill');
        fill.style.setProperty('--protocol-progress', `${progress}%`);
        shell.append(fill);
        row.append(shell);
      }

      list.append(row);
    });

    target.append(heading, list);
  }

  function renderPrinciples(protocol) {
    const target = document.querySelector('[data-protocol-principles]');
    const principles = protocol.principles || {};

    if (!target) {
      return;
    }

    target.className = 'protocol-principles terminal-panel';
    target.replaceChildren();

    const heading = createElement('div', 'section-heading');
    const list = createElement('ul', 'protocol-principle-list');

    heading.append(
      createElement('span', 'eyebrow', principles.eyebrow || 'Operating Rules'),
      createElement('h2', '', principles.title || 'LABORATORY PRINCIPLES')
    );

    asArray(principles.items).forEach((item) => {
      const row = createElement('li', '');
      row.append(
        createElement('span', 'protocol-principle-marker', '✓'),
        createElement('span', '', item)
      );
      list.append(row);
    });

    target.append(heading, list);
  }

  async function typeTerminalLines(target, lines) {
    const reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.replaceChildren();

    for (const line of lines) {
      const row = createElement('p', 'terminal-line');
      target.append(row);

      if (reducedMotion) {
        row.textContent = `> ${line}`;
        continue;
      }

      row.textContent = '> ';

      for (const character of String(line)) {
        row.textContent += character;
        await sleep(terminalCharacterDelay);
      }

      await sleep(terminalLineDelay);
    }

    target.append(createElement('span', 'console-cursor protocol-terminal-cursor'));
  }

  function renderTerminal(protocol) {
    const target = document.querySelector('[data-protocol-terminal]');
    const terminal = protocol.terminal || {};

    if (!target) {
      return;
    }

    target.className = 'protocol-terminal-panel terminal-panel';
    target.replaceChildren();

    const heading = createElement('div', 'section-heading');
    const output = createElement('div', 'protocol-terminal-output');

    heading.append(
      createElement('span', 'eyebrow', terminal.eyebrow || 'Final Terminal'),
      createElement('h2', '', terminal.title || 'STATUS REPORT')
    );

    target.append(heading, output);
    typeTerminalLines(output, asArray(terminal.lines));
  }

  async function init() {
    const data = global.B20Data;
    const ui = global.B20UI;
    const interactions = global.B20Interactions;

    if (ui) {
      ui.initReveal();
    }

    if (!data || !data.loadProtocol) {
      renderUnavailable();
      return;
    }

    const protocol = await data.loadProtocol();

    if (!protocol) {
      renderUnavailable();
      return;
    }

    renderHero(protocol);
    renderIntroduction(protocol);
    renderTimeline(protocol);
    renderTelemetry(protocol);
    renderPrinciples(protocol);
    renderTerminal(protocol);

    if (ui) {
      ui.initReveal();
    }

    if (interactions) {
      interactions.initReactivePanels();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
