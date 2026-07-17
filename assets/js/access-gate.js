(function () {
  function selectNode(selector) {
    return selector ? document.querySelector(selector) : null;
  }

  function hasStoredAccess(storageKey) {
    try {
      return window.sessionStorage.getItem(storageKey) === 'granted';
    } catch (error) {
      return false;
    }
  }

  function storeAccess(storageKey) {
    try {
      window.sessionStorage.setItem(storageKey, 'granted');
    } catch (error) {
      // Client-side gates must still work when storage is blocked.
    }
  }

  function initAccessGate(options) {
    const config = {
      enabled: true,
      password: '0xb20.lol',
      storageKey: 'b20-access',
      gateSelector: '',
      contentSelector: '',
      formSelector: '',
      inputSelector: '',
      errorSelector: '',
      onUnlock: null,
      ...options
    };

    const gate = selectNode(config.gateSelector);
    const content = selectNode(config.contentSelector);
    const form = selectNode(config.formSelector);
    const input = selectNode(config.inputSelector);
    const error = selectNode(config.errorSelector);

    const unlock = () => {
      storeAccess(config.storageKey);

      if (gate) {
        gate.hidden = true;
      }

      if (content) {
        content.hidden = false;
      }

      if (typeof config.onUnlock === 'function') {
        config.onUnlock();
      }
    };

    if (!config.enabled) {
      unlock();
      return;
    }

    if (!gate || !content || !form || !input) {
      unlock();
      return;
    }

    if (hasStoredAccess(config.storageKey)) {
      unlock();
      return;
    }

    gate.hidden = false;
    content.hidden = true;

    window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (input.value.trim() === config.password) {
        unlock();
        return;
      }

      if (error) {
        error.hidden = false;
      }

      input.select();
    });
  }

  window.B20AccessGate = {
    init: initAccessGate
  };
})();
