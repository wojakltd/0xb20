(function () {
  const allowedStyles = ['minimal', 'funny', 'philosophy', 'brutal', 'builder', 'random'];
  const endpoint = '/api/ai/generate';

  let selectedStyle = 'minimal';
  let lastRequest = null;
  let lastResult = null;
  let initialized = false;

  const form = document.querySelector('[data-ai-form]');
  const topicInput = document.querySelector('[data-ai-topic]');
  const submitButton = document.querySelector('[data-ai-submit]');
  const statusTarget = document.querySelector('[data-ai-status]');
  const engineState = document.querySelector('[data-ai-engine-state]');
  const outputTarget = document.querySelector('[data-ai-output]');
  const signalCard = document.querySelector('[data-ai-signal-card]');
  const postCard = document.querySelector('[data-ai-post-card]');
  const signalNumber = document.querySelector('[data-ai-signal-number]');
  const signalText = document.querySelector('[data-ai-signal-text]');
  const postText = document.querySelector('[data-ai-post-text]');
  const styleButtons = Array.from(document.querySelectorAll('[data-ai-style]'));
  const remixButton = document.querySelector('[data-ai-remix]');
  const postToggleButton = document.querySelector('[data-ai-post-toggle]');

  function setStatus(text) {
    if (statusTarget) {
      statusTarget.textContent = text;
    }
  }

  function setBusy(isBusy) {
    if (submitButton) {
      submitButton.disabled = isBusy;
    }

    if (engineState) {
      engineState.textContent = isBusy ? 'SYNTHESIZING' : 'ONLINE';
      engineState.classList.toggle('is-busy', isBusy);
    }
  }

  function normalizeStyle(style) {
    return allowedStyles.includes(style) ? style : 'minimal';
  }

  function resolveRequestStyle(style) {
    if (style !== 'random') {
      return style;
    }

    const pool = allowedStyles.filter((item) => item !== 'random');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function updateStyleSelection(style) {
    selectedStyle = normalizeStyle(style);

    styleButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.aiStyle === selectedStyle);
    });
  }

  function createSignalNumber() {
    const value = Math.floor(10000 + Math.random() * 89999);
    return `SIGNAL #${value}`;
  }

  async function copyText(text) {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.');
    } catch (error) {
      setStatus('Copy unavailable. Select output manually.');
    }
  }

  function renderResult(result) {
    lastResult = result;

    if (signalNumber) {
      signalNumber.textContent = createSignalNumber();
    }

    if (signalText) {
      signalText.textContent = result.signal;
    }

    if (postText) {
      postText.textContent = result.post;
    }

    if (outputTarget) {
      outputTarget.hidden = false;
    }

    if (signalCard) {
      signalCard.hidden = false;
    }

    if (postCard) {
      postCard.hidden = true;
    }

    setStatus('Signal acquired.');
  }

  async function generateSignal(topic, style) {
    const requestStyle = resolveRequestStyle(style);
    lastRequest = { topic, style };

    setBusy(true);
    setStatus('Synthesizing signal...');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          topic,
          style: requestStyle
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.signal || !payload.post) {
        throw new Error(payload.error || 'AI engine unavailable.');
      }

      renderResult(payload);
    } catch (error) {
      setStatus('AI engine unavailable. Research continues.');
    } finally {
      setBusy(false);
    }
  }

  function initAiLab() {
    if (initialized) {
      return;
    }

    initialized = true;

    if (window.B20UI && typeof window.B20UI.initReveal === 'function') {
      window.B20UI.initReveal();
    }

    updateStyleSelection(selectedStyle);
    setStatus('Engine idle.');
    setBusy(false);

    styleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        updateStyleSelection(button.dataset.aiStyle);
      });
    });

    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();

        const topic = topicInput ? topicInput.value.trim() : '';

        if (!topic) {
          setStatus('Input signal required.');
          if (topicInput) {
            topicInput.focus();
          }
          return;
        }

        generateSignal(topic, selectedStyle);
      });
    }

    if (remixButton) {
      remixButton.addEventListener('click', () => {
        if (lastRequest) {
          generateSignal(lastRequest.topic, lastRequest.style);
        }
      });
    }

    if (postToggleButton) {
      postToggleButton.addEventListener('click', () => {
        if (postCard && lastResult) {
          postCard.hidden = false;
          setStatus('X-ready transmission prepared.');
        }
      });
    }

    document.querySelectorAll('[data-ai-copy]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.aiCopy === 'post' ? lastResult?.post : lastResult?.signal;
        copyText(target);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.B20AccessGate) {
      initAiLab();
      return;
    }

    window.B20AccessGate.init({
      enabled: true,
      password: '0xb20.lol',
      storageKey: 'b20-ai-lab-access',
      gateSelector: '[data-ai-gate]',
      contentSelector: '[data-ai-content]',
      formSelector: '[data-ai-gate-form]',
      inputSelector: '[data-ai-password]',
      errorSelector: '[data-ai-gate-error]',
      onUnlock: initAiLab
    });
  });
})();
