(function (global) {
  const maxActivityItems = 6;
  const maxTerminalLines = 8;
  let activityTarget;
  let terminalTarget;
  let activityQueue = [];
  let terminalQueue = [];
  let activityIndex = 0;
  let terminalIndex = 0;

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

  function nowTime() {
    return new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());
  }

  function trimChildren(target, maxItems) {
    while (target.children.length > maxItems) {
      target.lastElementChild.remove();
    }
  }

  function pushActivity(entry) {
    if (!activityTarget || !entry) {
      return;
    }

    const item = createElement('div', 'activity-item is-streaming');
    const time = createElement('span', 'activity-time', entry.time || nowTime());
    const title = createElement('span', 'activity-title', entry.title || entry.message || 'Research continues');

    item.append(time, title);
    activityTarget.prepend(item);
    trimChildren(activityTarget, maxActivityItems);
  }

  function pushTerminalLine(message) {
    if (!terminalTarget || !message) {
      return;
    }

    const line = createElement('p', 'terminal-line', `[${nowTime()}] ${message}`);
    terminalTarget.prepend(line);
    trimChildren(terminalTarget, maxTerminalLines);
  }

  function startActivityFeed(activity) {
    activityTarget = document.querySelector('[data-activity-feed]');
    activityQueue = Array.isArray(activity) ? activity : [];

    if (!activityTarget || activityQueue.length === 0) {
      return;
    }

    activityTarget.replaceChildren();
    pushActivity(activityQueue[activityIndex]);
    activityIndex = (activityIndex + 1) % activityQueue.length;

    setInterval(() => {
      pushActivity(activityQueue[activityIndex]);
      activityIndex = (activityIndex + 1) % activityQueue.length;
    }, 3600);
  }

  function startLiveTerminal(events) {
    terminalTarget = document.querySelector('[data-live-terminal]');
    terminalQueue = Array.isArray(events) ? events : [];

    if (!terminalTarget || terminalQueue.length === 0) {
      return;
    }

    terminalTarget.replaceChildren();
    pushTerminalLine('Laboratory terminal attached');

    setInterval(() => {
      const event = terminalQueue[terminalIndex] || {};
      pushTerminalLine(event.message || event.title);
      terminalIndex = (terminalIndex + 1) % terminalQueue.length;
    }, 2800);
  }

  global.B20Terminal = {
    pushActivity,
    pushTerminalLine,
    startActivityFeed,
    startLiveTerminal
  };
})(window);
