(function (global) {
  function renderList(items) {
    const dom = global.B20AiRenderDom;
    const list = dom.el('ul', 'ai-bullet-list');
    items.filter(Boolean).forEach((item) => {
      const li = dom.el('li', '', item);
      list.appendChild(li);
    });
    return list;
  }

  function render(container, payload) {
    const dom = global.B20AiRenderDom;
    const sections = [
      ['Summary', payload?.summary],
      ['Generated Post', payload?.post],
      ['Thread', Array.isArray(payload?.items) ? payload.items : []],
      ['Bullet List', Array.isArray(payload?.bullets) ? payload.bullets : []],
      ['Builder Notes', Array.isArray(payload?.notes) ? payload.notes : []]
    ];

    sections.forEach(([title, value]) => {
      if (Array.isArray(value) && !value.length) {
        return;
      }

      if (!Array.isArray(value) && !value) {
        return;
      }

      const body = Array.isArray(value) ? renderList(value) : value;
      container.appendChild(dom.card(
        title,
        body,
        [
          dom.button(`Copy ${title}`, 'copy-section', { aiSection: title }),
          dom.button(`Remix ${title}`, 'remix-section', { aiSection: title, aiRemixMode: 'builder' })
        ]
      ));
    });
  }

  function text(payload) {
    return global.B20AiPreview.formatPayload(payload, 'summary');
  }

  global.B20AiRenderSummary = {
    render,
    text
  };
})(window);
