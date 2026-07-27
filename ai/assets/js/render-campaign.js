(function (global) {
  const labels = {
    launchPost: 'Launch',
    launchThread: 'Thread',
    replies: 'Replies',
    quoteTweet: 'Quote',
    followUp: 'Follow-up',
    reminder: 'Reminder',
    lastChance: 'Last Chance',
    finalUpdate: 'Final Update'
  };

  function entries(payload) {
    return global.B20AiPreview.campaignEntries(payload?.campaign || {});
  }

  function renderArray(key, value) {
    const dom = global.B20AiRenderDom;
    const list = dom.el('div', 'ai-thread-list');
    value.forEach((item, index) => {
      list.appendChild(dom.card(`Item ${index + 1}`, item, [
        dom.button('Copy Item', 'copy-campaign-item', { aiSection: key, aiIndex: index }),
        dom.button('Publish Item', 'publish-campaign-item', { aiSection: key, aiIndex: index })
      ]));
    });
    return list;
  }

  function render(container, payload) {
    const dom = global.B20AiRenderDom;
    entries(payload).forEach(([key, label, value]) => {
      const body = Array.isArray(value) ? renderArray(key, value) : value;
      container.appendChild(dom.card(
        labels[key] || label,
        body,
        [
          dom.button(`Copy ${labels[key] || label}`, 'copy-campaign', { aiSection: key }),
          dom.button(`Remix ${labels[key] || label}`, 'remix-campaign', { aiSection: key, aiRemixMode: 'professional' }),
          dom.button(`Generate X ${labels[key] || label}`, 'preview-campaign', { aiSection: key })
        ]
      ));
    });
  }

  function text(payload) {
    return global.B20AiPreview.formatCampaign(payload?.campaign || {});
  }

  global.B20AiRenderCampaign = {
    render,
    text,
    entries
  };
})(window);
