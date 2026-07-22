(function () {
  const allowedStyles = ['minimal', 'funny', 'philosophy', 'brutal', 'builder', 'random'];
  const allowedLanguages = new Set(['auto', 'en', 'ru', 'es', 'pt', 'fr', 'de', 'it', 'tr', 'id', 'vi', 'ar', 'hi', 'zh', 'ja', 'ko']);
  const endpoint = '/api/ai/generate';
  const postLimit = 280;
  const maxHistoryItems = 10;
  const attributionText = 'Generated with https://0xb20.lol/ai';
  const aiLabAccessGateEnabled = false;
  const storageKeys = {
    signals: 'b20-ai-lab-signals',
    posts: 'b20-ai-lab-posts',
    favorites: 'b20-ai-lab-favorites',
    language: 'b20-ai-lab-language'
  };

  let selectedStyle = 'minimal';
  let selectedLanguage = 'auto';
  let currentTopic = '';
  let currentSignal = '';
  let currentPost = null;
  let currentFinalPost = '';
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
  const counterTarget = document.querySelector('[data-ai-counter]');
  const publishLink = document.querySelector('[data-ai-publish]');
  const styleButtons = Array.from(document.querySelectorAll('[data-ai-style]'));
  const optionInputs = Array.from(document.querySelectorAll('[data-ai-option]'));
  const languageSelect = document.querySelector('[data-ai-language]');
  const remixButton = document.querySelector('[data-ai-remix]');
  const favoriteButton = document.querySelector('[data-ai-favorite]');
  const postGenerateButton = document.querySelector('[data-ai-post-generate]');
  const signalHistoryTarget = document.querySelector('[data-ai-signal-history]');
  const postHistoryTarget = document.querySelector('[data-ai-post-history]');
  const favoritesTarget = document.querySelector('[data-ai-favorites]');

  function setStatus(text) {
    if (statusTarget) {
      statusTarget.textContent = text;
    }
  }

  function setBusy(isBusy, label) {
    if (submitButton) {
      submitButton.disabled = isBusy;
    }

    if (remixButton) {
      remixButton.disabled = isBusy;
    }

    if (postGenerateButton) {
      postGenerateButton.disabled = isBusy;
    }

    if (engineState) {
      engineState.textContent = isBusy ? label || 'SYNTHESIZING' : 'ONLINE';
      engineState.classList.toggle('is-busy', isBusy);
    }
  }

  function normalizeStyle(style) {
    return allowedStyles.includes(style) ? style : 'minimal';
  }

  function normalizeLanguage(language) {
    if (typeof language !== 'string') {
      return 'auto';
    }

    const normalized = language.trim().toLowerCase();
    return allowedLanguages.has(normalized) ? normalized : 'auto';
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

  function readLanguagePreference() {
    try {
      return normalizeLanguage(window.localStorage.getItem(storageKeys.language));
    } catch (error) {
      return 'auto';
    }
  }

  function updateLanguageSelection(language) {
    selectedLanguage = normalizeLanguage(language);

    if (languageSelect) {
      languageSelect.value = selectedLanguage;
    }

    try {
      window.localStorage.setItem(storageKeys.language, selectedLanguage);
    } catch (error) {
      // Output language is a preference only; generation should continue without storage.
    }
  }

  function getOptions() {
    return optionInputs.reduce((options, input) => {
      options[input.dataset.aiOption] = input.checked;
      return options;
    }, {
      emojis: false,
      hashtags: false,
      attribution: false
    });
  }

  function setOptions(options) {
    optionInputs.forEach((input) => {
      input.checked = Boolean(options && options[input.dataset.aiOption]);
    });
  }

  function createSignalNumber() {
    const value = Math.floor(10000 + Math.random() * 89999);
    return `SIGNAL #${value}`;
  }

  function readStorage(key) {
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value.slice(0, maxHistoryItems)));
    } catch (error) {
      // Local memory is optional; generation must continue if storage is blocked.
    }
  }

  function remember(key, entry) {
    const existing = readStorage(key).filter((item) => item.text !== entry.text);
    writeStorage(key, [{ ...entry, savedAt: new Date().toISOString() }, ...existing]);
    renderMemory();
  }

  function assemblePost(postData, options) {
    if (!postData || !postData.post) {
      return '';
    }

    const emojis = options.emojis && postData.emojis && postData.emojis.length
      ? ` ${postData.emojis.join(' ')}`
      : '';
    const parts = [`${postData.post.trim()}${emojis}`.trim()];

    if (options.hashtags && postData.hashtags && postData.hashtags.length) {
      parts.push(postData.hashtags.join(' '));
    }

    if (options.attribution) {
      parts.push(attributionText);
    }

    return parts.filter(Boolean).join('\n\n');
  }

  function updatePostPreview() {
    const options = getOptions();
    currentFinalPost = assemblePost(currentPost, options);

    if (postText) {
      postText.textContent = currentFinalPost;
    }

    const count = currentFinalPost.length;
    const isOverLimit = count > postLimit;

    if (counterTarget) {
      counterTarget.textContent = `${count} / ${postLimit}`;
      counterTarget.classList.toggle('is-over', isOverLimit);
    }

    if (publishLink) {
      publishLink.hidden = !currentFinalPost || isOverLimit;
      publishLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(currentFinalPost)}`;
      publishLink.setAttribute('aria-disabled', isOverLimit ? 'true' : 'false');
    }

    if (currentFinalPost && isOverLimit) {
      setStatus('Transmission exceeds X limit. Regenerate with current options.');
    }
  }

  async function copyText(text, successMessage) {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus(successMessage);
    } catch (error) {
      setStatus('Copy unavailable. Select output manually.');
    }
  }

  function renderSignal(signal, shouldRemember = true) {
    currentSignal = signal;
    currentPost = null;
    currentFinalPost = '';

    if (signalNumber) {
      signalNumber.textContent = createSignalNumber();
    }

    if (signalText) {
      signalText.textContent = signal;
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

    if (shouldRemember) {
      remember(storageKeys.signals, { text: signal, topic: currentTopic, style: selectedStyle, language: selectedLanguage });
    }

    setStatus('Signal acquired.');
  }

  function renderPost(payload, options, shouldRemember = true) {
    currentPost = {
      post: payload.post || '',
      hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
      emojis: Array.isArray(payload.emojis) ? payload.emojis : []
    };

    if (postCard) {
      postCard.hidden = false;
    }

    updatePostPreview();

    if (shouldRemember) {
      remember(storageKeys.posts, {
        text: currentFinalPost,
        signal: currentSignal,
        post: currentPost.post,
        hashtags: currentPost.hashtags,
        emojis: currentPost.emojis,
        options,
        language: selectedLanguage
      });
    }

    setStatus('Transmission ready.');
  }

  async function requestAi(payload) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'AI engine unavailable.');
    }

    return data;
  }

  async function generateSignal(topic, style) {
    currentTopic = topic;
    const requestStyle = resolveRequestStyle(style);

    setBusy(true, 'SYNTHESIZING');
    setStatus('Synthesizing signal...');

    try {
      const payload = await requestAi({
        action: 'generateSignal',
        topic,
        style: requestStyle,
        language: selectedLanguage
      });

      if (!payload.signal) {
        throw new Error('Unreadable signal.');
      }

      renderSignal(payload.signal);
    } catch (error) {
      setStatus('Synthesis failed. Laboratory signal unstable.');
    } finally {
      setBusy(false);
    }
  }

  async function remixSignal() {
    if (!currentSignal) {
      setStatus('No signal available for remix.');
      return;
    }

    const requestStyle = resolveRequestStyle(selectedStyle);

    setBusy(true, 'REMIXING');
    setStatus('Synthesizing signal...');

    try {
      const payload = await requestAi({
        action: 'remixSignal',
        topic: currentTopic,
        signal: currentSignal,
        style: requestStyle,
        language: selectedLanguage
      });

      if (!payload.signal) {
        throw new Error('Unreadable remix.');
      }

      renderSignal(payload.signal);
    } catch (error) {
      setStatus('Remix failed. Signal rejected.');
    } finally {
      setBusy(false);
    }
  }

  async function generatePost() {
    if (!currentSignal) {
      setStatus('Generate a signal first.');
      return;
    }

    const options = getOptions();
    const requestStyle = resolveRequestStyle(selectedStyle);

    setBusy(true, 'TRANSMITTING');
    setStatus('Preparing X transmission...');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const payload = await requestAi({
          action: 'generatePost',
          topic: currentTopic,
          signal: currentSignal,
          style: requestStyle,
          language: selectedLanguage,
          options
        });

        const preview = assemblePost(payload, options);

        if (payload.post && preview.length <= postLimit) {
          renderPost(payload, options);
          setBusy(false);
          return;
        }
      } catch (error) {
        if (attempt === 2) {
          setStatus('Transmission failed. Laboratory channel unstable.');
        }
      }
    }

    setStatus('Transmission exceeded X limit. Try fewer options or regenerate.');
    setBusy(false);
  }

  function restoreSignal(entry) {
    currentTopic = entry.topic || currentTopic;
    selectedStyle = normalizeStyle(entry.style || selectedStyle);
    updateStyleSelection(selectedStyle);
    updateLanguageSelection(entry.language || selectedLanguage);
    renderSignal(entry.text, false);
  }

  function restorePost(entry) {
    if (entry.signal) {
      currentSignal = entry.signal;
      if (signalText) {
        signalText.textContent = entry.signal;
      }
      if (signalCard) {
        signalCard.hidden = false;
      }
      if (outputTarget) {
        outputTarget.hidden = false;
      }
    }

    updateLanguageSelection(entry.language || selectedLanguage);
    setOptions(entry.options || {});
    renderPost({
      post: entry.post || entry.text,
      hashtags: entry.hashtags || [],
      emojis: entry.emojis || []
    }, getOptions(), false);
  }

  function renderMemoryList(target, items, emptyText, type) {
    if (!target) {
      return;
    }

    target.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-memory-empty';
      empty.textContent = emptyText;
      target.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-memory-item';
      button.dataset.aiRestoreType = type;
      button.dataset.aiRestoreIndex = String(index);
      button.textContent = item.text;
      target.appendChild(button);
    });
  }

  function renderMemory() {
    renderMemoryList(
      signalHistoryTarget,
      readStorage(storageKeys.signals),
      'No restored signals yet.',
      'signal'
    );
    renderMemoryList(
      postHistoryTarget,
      readStorage(storageKeys.posts),
      'No transmissions yet.',
      'post'
    );
    renderMemoryList(
      favoritesTarget,
      readStorage(storageKeys.favorites),
      'No favourites saved.',
      'favorite'
    );
  }

  function handleMemoryRestore(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest('[data-ai-restore-type]');

    if (!button) {
      return;
    }

    const type = button.dataset.aiRestoreType;
    const index = Number(button.dataset.aiRestoreIndex);
    const key = type === 'post' ? storageKeys.posts : type === 'favorite' ? storageKeys.favorites : storageKeys.signals;
    const entry = readStorage(key)[index];

    if (!entry) {
      return;
    }

    if (type === 'post') {
      restorePost(entry);
      setStatus('Transmission restored.');
      return;
    }

    restoreSignal(entry);
    setStatus(type === 'favorite' ? 'Favourite signal restored.' : 'Signal restored.');
  }

  function saveFavorite() {
    if (!currentSignal) {
      setStatus('No signal available to save.');
      return;
    }

    remember(storageKeys.favorites, {
      text: currentSignal,
      topic: currentTopic,
      style: selectedStyle,
      language: selectedLanguage
    });
    setStatus('Favourite signal saved.');
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
    updateLanguageSelection(readLanguagePreference());
    renderMemory();
    setStatus('Engine idle.');
    setBusy(false);

    styleButtons.forEach((button) => {
      button.addEventListener('click', () => {
        updateStyleSelection(button.dataset.aiStyle);
      });
    });

    optionInputs.forEach((input) => {
      input.addEventListener('change', updatePostPreview);
    });

    if (languageSelect) {
      languageSelect.addEventListener('change', () => {
        updateLanguageSelection(languageSelect.value);
      });
    }

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
      remixButton.addEventListener('click', remixSignal);
    }

    if (favoriteButton) {
      favoriteButton.addEventListener('click', saveFavorite);
    }

    if (postGenerateButton) {
      postGenerateButton.addEventListener('click', generatePost);
    }

    document.querySelectorAll('[data-ai-copy]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.aiCopy === 'post' ? currentFinalPost : currentSignal;
        const message = button.dataset.aiCopy === 'post' ? 'X post copied.' : 'Signal copied.';
        copyText(target, message);
      });
    });

    [signalHistoryTarget, postHistoryTarget, favoritesTarget].forEach((target) => {
      if (target) {
        target.addEventListener('click', handleMemoryRestore);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.B20AccessGate) {
      initAiLab();
      return;
    }

    window.B20AccessGate.init({
      enabled: aiLabAccessGateEnabled,
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
