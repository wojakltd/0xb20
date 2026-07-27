(function (global) {
  function el(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined && text !== null) {
      node.textContent = text;
    }

    return node;
  }

  function button(label, action, data = {}) {
    const node = el('button', '', label);
    node.type = 'button';
    node.dataset.aiAction = action;

    Object.entries(data).forEach(([key, value]) => {
      node.dataset[key] = String(value);
    });

    return node;
  }

  function link(label, href) {
    const node = el('a', '', label);
    node.href = href || '#';
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  }

  function textBlock(text, className = 'ai-content-block') {
    const node = el('div', className);
    node.textContent = text || '';
    return node;
  }

  function card(title, body, actions = []) {
    const node = el('article', 'ai-render-card');
    const heading = el('h3', '', title);
    const content = typeof body === 'string' ? textBlock(body) : body;
    const actionRow = el('div', 'ai-output-actions ai-inline-actions');

    actions.forEach((item) => actionRow.appendChild(item));
    node.append(heading, content);

    if (actions.length) {
      node.appendChild(actionRow);
    }

    return node;
  }

  function actionRow(actions) {
    const row = el('div', 'ai-output-actions');
    actions.forEach((action) => row.appendChild(action));
    return row;
  }

  function numberedText(items) {
    const list = el('div', 'ai-numbered-list');
    items.forEach((item, index) => {
      const row = el('article', 'ai-numbered-item');
      row.append(el('span', 'ai-numbered-index', String(index + 1)), textBlock(item));
      list.appendChild(row);
    });
    return list;
  }

  function renderAnalysis(target, text) {
    if (!target) {
      return;
    }

    const data = global.B20AiPreview.analyze(text);
    const rows = [
      ['Readability', `${data.readability} (${data.readabilityScore}/100)`],
      ['Engagement', `${data.engagementScore}/100`],
      ['Builder', `${data.builderScore}/100`],
      ['Virality', `${data.virality}/100`],
      ['Professionalism', `${data.professionalism}/100`],
      ['Length', String(data.characterCount)],
      ['Hashtags', String(data.hashtags)],
      ['Mentions', String(data.mentions)],
      ['Emoji Density', `${data.emojiDensity}%`],
      ['CTA', data.ctaDetected ? 'Detected' : 'Missing'],
      ['Question', data.questionDetected ? 'Detected' : 'No'],
      ['Estimate', data.estimatedEngagement]
    ];

    target.innerHTML = '';
    rows.forEach(([label, value]) => {
      const item = el('div');
      item.append(el('span', '', label), el('strong', '', value));
      target.appendChild(item);
    });
  }

  global.B20AiRenderDom = {
    el,
    button,
    link,
    textBlock,
    card,
    actionRow,
    numberedText,
    renderAnalysis
  };
})(window);
