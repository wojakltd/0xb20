(function (global) {
  function items(payload) {
    return Array.isArray(payload?.items) ? payload.items.filter(Boolean) : [];
  }

  function render(container, payload) {
    const dom = global.B20AiRenderDom;
    const replies = items(payload);
    const list = dom.el('div', 'ai-reply-list');

    replies.forEach((reply, index) => {
      list.appendChild(dom.card(
        `Reply ${index + 1}`,
        reply,
        [
          dom.button('Copy Reply', 'copy-item', { aiIndex: index }),
          dom.button('Publish Reply', 'publish-item', { aiIndex: index }),
          dom.button('Remix Reply', 'remix-item', { aiIndex: index, aiRemixMode: 'more viral' })
        ]
      ));
    });

    container.appendChild(list);
  }

  function text(payload) {
    return items(payload).join('\n\n');
  }

  global.B20AiRenderReplies = {
    render,
    text,
    items
  };
})(window);
