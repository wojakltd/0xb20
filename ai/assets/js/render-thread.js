(function (global) {
  function items(payload) {
    return Array.isArray(payload?.items) ? payload.items.filter(Boolean) : [];
  }

  function render(container, payload) {
    const dom = global.B20AiRenderDom;
    const thread = items(payload);
    const list = dom.el('div', 'ai-thread-list');

    thread.forEach((tweet, index) => {
      const card = dom.card(
        `Tweet ${index + 1}/${thread.length}`,
        tweet,
        [
          dom.button(`Copy Tweet ${index + 1}`, 'copy-item', { aiIndex: index }),
          dom.button(`Publish Tweet ${index + 1}`, 'publish-item', { aiIndex: index }),
          dom.button('Remix Tweet', 'remix-item', { aiIndex: index, aiRemixMode: 'more viral' })
        ]
      );
      list.appendChild(card);
    });

    container.appendChild(list);
  }

  function text(payload) {
    return items(payload).join('\n\n');
  }

  global.B20AiRenderThread = {
    render,
    text,
    items
  };
})(window);
