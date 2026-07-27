(function (global) {
  function items(payload) {
    return Array.isArray(payload?.items) ? payload.items.filter(Boolean) : [];
  }

  function stripThreadNumber(value) {
    return String(value || '')
      .trim()
      .replace(/^\s*(?:tweet\s*)?\d+\s*\/\s*\d+\s*[:.)-]?\s*/i, '')
      .replace(/^\s*(?:tweet\s*)?\d+\s*[:.)-]\s*/i, '')
      .trim();
  }

  function tweetId(value) {
    const source = String(value || '').trim();
    const match = source.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i) || source.match(/\b(\d{10,})\b/);
    return match ? match[1] : '';
  }

  function replyControls(dom, index, payload) {
    if (index === 0) {
      return [
        dom.button('Publish Tweet 1', 'publish-item', { aiIndex: 0 })
      ];
    }

    const storedValue = payload?.replyTargets?.[index] || '';
    const input = dom.el('input', 'ai-thread-link-input');
    input.type = 'url';
    input.value = storedValue;
    input.placeholder = `Paste tweet ${index} URL`;
    input.dataset.aiThreadTarget = index;

    const button = dom.button(`Publish Tweet ${index + 1} as Reply`, 'publish-item', { aiIndex: index });
    button.disabled = !tweetId(storedValue);

    return [input, button];
  }

  function render(container, payload) {
    const dom = global.B20AiRenderDom;
    const thread = items(payload).map(stripThreadNumber).filter(Boolean);
    const list = dom.el('div', 'ai-thread-list');

    thread.forEach((tweet, index) => {
      const card = dom.card(
        `Tweet ${index + 1}/${thread.length}`,
        tweet,
        [
          dom.button(`Copy Tweet ${index + 1}`, 'copy-item', { aiIndex: index }),
          ...replyControls(dom, index, payload),
          dom.button('Remix Tweet', 'remix-item', { aiIndex: index, aiRemixMode: 'more viral' })
        ]
      );
      list.appendChild(card);
    });

    container.appendChild(list);
  }

  function text(payload) {
    return items(payload).map(stripThreadNumber).filter(Boolean).join('\n\n');
  }

  global.B20AiRenderThread = {
    render,
    text,
    items
  };
})(window);
