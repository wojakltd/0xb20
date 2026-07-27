(function () {
  const accessGateEnabled = false;
  const features = window.B20AiFeatures;
  const storage = window.B20AiStorage;
  const preview = window.B20AiPreview;
  const core = window.B20AiCore;
  const generator = window.B20AiGenerator;
  const library = window.B20AiLibrary;

  const state = {
    mode: features.normalizeMode(storage.readPreference(storage.keys.mode, 'signal')),
    style: features.normalizeStyle(storage.readPreference(storage.keys.style, 'builder')),
    language: features.normalizeLanguage(storage.readPreference(storage.keys.language, 'auto')),
    agent: features.normalizeAgent(storage.readPreference(storage.keys.agent, 'builder')),
    count: 4,
    topic: '',
    resultPayload: null,
    resultText: '',
    postPayload: null,
    finalPost: '',
    initialized: false
  };

  const form = document.querySelector('[data-ai-form]');
  const topicInput = document.querySelector('[data-ai-topic]');
  const primaryLabel = document.querySelector('[data-ai-primary-label]');
  const contextHelp = document.querySelector('[data-ai-context-help]');
  const submitButton = document.querySelector('[data-ai-submit]');
  const statusTarget = document.querySelector('[data-ai-status]');
  const engineState = document.querySelector('[data-ai-engine-state]');
  const outputTarget = document.querySelector('[data-ai-output]');
  const resultCard = document.querySelector('[data-ai-result-card]');
  const resultKicker = document.querySelector('[data-ai-result-kicker]');
  const resultText = document.querySelector('[data-ai-result-text]');
  const postCard = document.querySelector('[data-ai-post-card]');
  const postText = document.querySelector('[data-ai-post-text]');
  const counterTarget = document.querySelector('[data-ai-counter]');
  const publishLink = document.querySelector('[data-ai-publish]');
  const analysisTarget = document.querySelector('[data-ai-analysis]');
  const modeButtons = Array.from(document.querySelectorAll('[data-ai-mode]'));
  const styleButtons = Array.from(document.querySelectorAll('[data-ai-style]'));
  const optionInputs = Array.from(document.querySelectorAll('[data-ai-option]'));
  const languageSelect = document.querySelector('[data-ai-language]');
  const agentSelect = document.querySelector('[data-ai-agent]');
  const countSelect = document.querySelector('[data-ai-count]');
  const promptCategorySelect = document.querySelector('[data-ai-library-category]');
  const promptList = document.querySelector('[data-ai-prompt-list]');
  const loadPromptButton = document.querySelector('[data-ai-load-prompt]');
  const memoryForm = document.querySelector('[data-ai-memory-form]');
  const saveMemoryButton = document.querySelector('[data-ai-save-memory]');
  const personaSelect = document.querySelector('[data-ai-persona]');
  const personaNameInput = document.querySelector('[data-ai-persona-name]');
  const personaGuidanceInput = document.querySelector('[data-ai-persona-guidance]');
  const savePersonaButton = document.querySelector('[data-ai-save-persona]');
  const historySearch = document.querySelector('[data-ai-history-search]');
  const outputHistoryTarget = document.querySelector('[data-ai-output-history]');
  const postHistoryTarget = document.querySelector('[data-ai-post-history]');
  const favoritesTarget = document.querySelector('[data-ai-favorites]');

  function setStatus(text) {
    if (statusTarget) {
      statusTarget.textContent = text;
    }
  }

  function setBusy(isBusy, label) {
    const buttons = [
      submitButton,
      ...Array.from(document.querySelectorAll('[data-ai-remix], [data-ai-post-generate], [data-ai-favorite], [data-ai-copy]'))
    ];

    buttons.forEach((button) => {
      if (button) {
        button.disabled = isBusy;
      }
    });

    if (engineState) {
      engineState.textContent = isBusy ? label || 'SYNTHESIZING' : 'ONLINE';
      engineState.classList.toggle('is-busy', isBusy);
    }
  }

  function createResultNumber(mode) {
    const value = Math.floor(10000 + Math.random() * 89999);
    return `${features.byId(features.modes, mode).label.toUpperCase()} #${value}`;
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

  function selectedPersona() {
    const personas = storage.readPersonas();
    return personas.find((persona) => persona.id === personaSelect?.value) || personas[0] || null;
  }

  function currentRequestState() {
    return {
      ...state,
      topic: topicInput ? topicInput.value.trim() : '',
      style: features.resolveStyle(state.style),
      count: Number(countSelect?.value || state.count || 4),
      memory: storage.readMemory(),
      persona: selectedPersona(),
      options: getOptions()
    };
  }

  function renderSelect(select, entries, selectedValue) {
    if (!select) {
      return;
    }

    select.innerHTML = '';
    entries.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === selectedValue;
      select.appendChild(option);
    });
  }

  function updateMode(mode) {
    state.mode = features.normalizeMode(mode);
    storage.writePreference(storage.keys.mode, state.mode);

    const config = features.byId(features.modes, state.mode);
    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.aiMode === state.mode);
    });

    if (topicInput) {
      topicInput.placeholder = config.placeholder;
    }

    if (primaryLabel) {
      primaryLabel.textContent = config.label.replace(' Generator', '').replace('Research ', 'Research ');
    }

    if (contextHelp) {
      contextHelp.textContent = state.mode === 'campaign'
        ? 'Campaign generates launch post, thread, replies, quote, follow-up, reminder, last chance and final update.'
        : state.mode === 'summary'
          ? 'Paste source material. The Laboratory returns an X post, thread, bullets and builder notes.'
          : 'Examples: builders, airdrops, fear, liquidity, Base, memecoins, decentralization, AI, crypto, markets';
    }
  }

  function updateStyle(style) {
    state.style = features.normalizeStyle(style);
    storage.writePreference(storage.keys.style, state.style);
    styleButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.aiStyle === state.style);
    });
  }

  function updateLanguage(language) {
    state.language = features.normalizeLanguage(language);
    storage.writePreference(storage.keys.language, state.language);
    if (languageSelect) {
      languageSelect.value = state.language;
    }
    updatePostPreview();
  }

  function updateAgent(agent) {
    state.agent = features.normalizeAgent(agent);
    storage.writePreference(storage.keys.agent, state.agent);
    if (agentSelect) {
      agentSelect.value = state.agent;
    }
  }

  function renderAnalysis(text) {
    if (!analysisTarget) {
      return;
    }

    const data = preview.analyze(text);
    const rows = [
      ['Readability', data.readability],
      ['Engagement', `${data.engagementScore}/100`],
      ['Builder', `${data.builderScore}/100`],
      ['Virality', `${data.virality}/100`],
      ['Length', String(data.characterCount)],
      ['Hashtags', String(data.hashtags)],
      ['Mentions', String(data.mentions)]
    ];

    analysisTarget.innerHTML = '';
    rows.forEach(([label, value]) => {
      const item = document.createElement('div');
      const key = document.createElement('span');
      const strong = document.createElement('strong');
      key.textContent = label;
      strong.textContent = value;
      item.append(key, strong);
      analysisTarget.appendChild(item);
    });
  }

  function updatePostPreview() {
    if (!state.postPayload) {
      return;
    }

    state.finalPost = preview.assemblePost(state.postPayload, getOptions());

    if (postText) {
      postText.textContent = state.finalPost;
    }

    if (counterTarget) {
      counterTarget.textContent = `${state.finalPost.length} / ${preview.postLimit}`;
      counterTarget.classList.toggle('is-over', state.finalPost.length > preview.postLimit);
    }

    if (publishLink) {
      const overLimit = state.finalPost.length > preview.postLimit;
      publishLink.hidden = !state.finalPost || overLimit;
      publishLink.href = preview.tweetIntent(state.finalPost);
      publishLink.setAttribute('aria-disabled', overLimit ? 'true' : 'false');
    }

    renderAnalysis(state.finalPost);
  }

  function renderResult(payload, mode, remember = true) {
    state.resultPayload = payload || {};
    state.resultText = preview.formatPayload(payload);
    state.postPayload = null;
    state.finalPost = '';

    if (resultKicker) {
      resultKicker.textContent = createResultNumber(mode);
    }

    if (resultText) {
      resultText.textContent = state.resultText;
    }

    if (outputTarget) {
      outputTarget.hidden = false;
    }

    if (resultCard) {
      resultCard.hidden = false;
    }

    if (postCard) {
      postCard.hidden = true;
    }

    if (remember) {
      storage.remember(storage.keys.outputs, {
        type: mode,
        text: state.resultText,
        payload,
        topic: state.topic,
        style: state.style,
        language: state.language,
        agent: state.agent
      });
      renderMemory();
    }

    setStatus('Output acquired.');
  }

  function renderPost(payload, remember = true) {
    state.postPayload = {
      post: payload.post || payload.signal || payload.text || '',
      hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
      emojis: Array.isArray(payload.emojis) ? payload.emojis : []
    };

    if (postCard) {
      postCard.hidden = false;
    }

    updatePostPreview();

    if (remember) {
      storage.remember(storage.keys.posts, {
        type: 'post',
        text: state.finalPost,
        payload: state.postPayload,
        source: state.resultText,
        language: state.language
      });
      renderMemory();
    }

    setStatus('Transmission ready.');
  }

  async function generateSelected(event) {
    event.preventDefault();

    const requestState = currentRequestState();
    state.topic = requestState.topic;

    if (!requestState.topic) {
      setStatus('Input signal required.');
      topicInput?.focus();
      return;
    }

    setBusy(true, 'SYNTHESIZING');
    setStatus('Synthesizing laboratory output...');

    try {
      const payload = await generator.generate(requestState);
      renderResult(payload, state.mode);

      if (state.mode === 'signal') {
        renderPost({ post: payload.signal || state.resultText, hashtags: payload.hashtags || [], emojis: payload.emojis || [] }, false);
      }
    } catch (error) {
      setStatus(core.errorMessage(error, 'Synthesis failed. Laboratory signal unstable.'));
    } finally {
      setBusy(false);
    }
  }

  async function generateXPost() {
    if (!state.resultText) {
      setStatus('Generate output first.');
      return;
    }

    const requestState = currentRequestState();
    setBusy(true, 'TRANSMITTING');
    setStatus('Preparing X transmission...');

    try {
      const payload = await generator.generatePost(requestState, state.resultText);
      const assembled = preview.assemblePost(payload, getOptions());

      if (!payload.post || assembled.length > preview.postLimit) {
        throw new Error('Transmission exceeded X limit. Try fewer options.');
      }

      renderPost(payload);
    } catch (error) {
      setStatus(core.errorMessage(error, 'Transmission failed. Laboratory channel unstable.'));
    } finally {
      setBusy(false);
    }
  }

  async function remixOutput(remixMode) {
    if (!state.resultText) {
      setStatus('No output available for remix.');
      return;
    }

    const requestState = currentRequestState();
    setBusy(true, 'REMIXING');
    setStatus('Remixing output...');

    try {
      const payload = await generator.remix(requestState, state.resultText, remixMode);
      renderResult(payload, state.mode);
    } catch (error) {
      setStatus(core.errorMessage(error, 'Remix failed. Signal rejected.'));
    } finally {
      setBusy(false);
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

  function renderMemoryList(target, items, emptyText, type, search = '') {
    if (!target) {
      return;
    }

    const query = search.trim().toLowerCase();
    const filtered = query
      ? items.filter((item) => String(item.text || '').toLowerCase().includes(query))
      : items;

    target.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-memory-empty';
      empty.textContent = emptyText;
      target.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-memory-item';
      button.dataset.aiRestoreType = type;
      button.dataset.aiRestoreId = item.savedAt || item.text;
      button.textContent = item.text;
      target.appendChild(button);
    });
  }

  function renderMemory() {
    renderMemoryList(
      outputHistoryTarget,
      storage.readList(storage.keys.outputs),
      'No outputs generated yet.',
      'output',
      historySearch?.value || ''
    );
    renderMemoryList(
      postHistoryTarget,
      storage.readList(storage.keys.posts),
      'No transmissions yet.',
      'post'
    );
    renderMemoryList(
      favoritesTarget,
      storage.readList(storage.keys.favorites),
      'No favourites saved.',
      'favorite'
    );
  }

  function findStoredEntry(type, id) {
    const key = type === 'post' ? storage.keys.posts : type === 'favorite' ? storage.keys.favorites : storage.keys.outputs;
    return storage.readList(key).find((item) => (item.savedAt || item.text) === id);
  }

  function restoreEntry(event) {
    const button = event.target instanceof Element ? event.target.closest('[data-ai-restore-type]') : null;

    if (!button) {
      return;
    }

    const entry = findStoredEntry(button.dataset.aiRestoreType, button.dataset.aiRestoreId);

    if (!entry) {
      return;
    }

    if (button.dataset.aiRestoreType === 'post') {
      state.resultText = entry.source || entry.text;
      renderPost(entry.payload || { post: entry.text }, false);
      setStatus('Transmission restored.');
      return;
    }

    renderResult(entry.payload || { signal: entry.text }, entry.type || state.mode, false);
    setStatus(button.dataset.aiRestoreType === 'favorite' ? 'Favourite restored.' : 'Output restored.');
  }

  async function saveFavorite() {
    if (!state.resultText) {
      setStatus('No output available to save.');
      return;
    }

    if (!(await core.requirePremium(['aiLabSavedOutputs', 'Saved Outputs']))) {
      return;
    }

    storage.remember(storage.keys.favorites, {
      type: state.mode,
      text: state.resultText,
      payload: state.resultPayload,
      topic: state.topic,
      style: state.style,
      language: state.language
    });
    renderMemory();
    setStatus('Favourite saved.');
  }

  function renderPromptLibrary() {
    if (!promptCategorySelect || !promptList) {
      return;
    }

    const selected = promptCategorySelect.value || library.categories()[0];
    promptList.innerHTML = '';

    library.prompts(selected).forEach((prompt) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-memory-item';
      button.textContent = prompt;
      button.addEventListener('click', () => {
        if (topicInput) {
          topicInput.value = prompt;
          topicInput.focus();
        }
        setStatus('Prompt loaded.');
      });
      promptList.appendChild(button);
    });

    if (!promptList.children.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-memory-empty';
      empty.textContent = 'No saved prompts in this category.';
      promptList.appendChild(empty);
    }
  }

  async function saveMemory() {
    if (!(await core.requirePremium(['aiLabProjectMemory', 'Project Memory']))) {
      return;
    }

    const memory = {};
    memoryForm?.querySelectorAll('[data-ai-memory-field]').forEach((input) => {
      memory[input.dataset.aiMemoryField] = input.value.trim();
    });
    storage.saveMemory(memory);
    setStatus('Project memory saved.');
  }

  function hydrateMemoryForm() {
    const memory = storage.readMemory();
    memoryForm?.querySelectorAll('[data-ai-memory-field]').forEach((input) => {
      input.value = memory[input.dataset.aiMemoryField] || '';
    });
  }

  function renderPersonas() {
    if (!personaSelect) {
      return;
    }

    const previousValue = personaSelect.value;
    const personas = storage.readPersonas();
    personaSelect.innerHTML = '';
    personas.forEach((persona) => {
      const option = document.createElement('option');
      option.value = persona.id;
      option.textContent = persona.name;
      personaSelect.appendChild(option);
    });

    const current = personas.find((persona) => persona.id === previousValue) || personas[0];
    if (current) {
      personaSelect.value = current.id;
      if (personaNameInput) {
        personaNameInput.value = current.name;
      }
      if (personaGuidanceInput) {
        personaGuidanceInput.value = current.guidance;
      }
    }
  }

  async function savePersona() {
    if (!(await core.requirePremium(['aiLabSavedPersonas', 'Saved Personas']))) {
      return;
    }

    const name = personaNameInput?.value.trim() || '';
    const guidance = personaGuidanceInput?.value.trim() || '';

    if (!name || !guidance) {
      setStatus('Persona name and guidance required.');
      return;
    }

    const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || Date.now()}`;
    storage.savePersona({ id, name, guidance });
    renderPersonas();
    personaSelect.value = id;
    setStatus('Persona saved.');
  }

  function initControls() {
    renderSelect(languageSelect, features.languages, state.language);
    renderSelect(agentSelect, features.agents, state.agent);
    renderSelect(promptCategorySelect, library.categories().map((item) => [item, item]), library.categories()[0]);

    updateMode(state.mode);
    updateStyle(state.style);
    updateLanguage(state.language);
    updateAgent(state.agent);
    hydrateMemoryForm();
    renderPersonas();
    renderPromptLibrary();
    renderMemory();
  }

  function bindEvents() {
    modeButtons.forEach((button) => button.addEventListener('click', () => updateMode(button.dataset.aiMode)));
    styleButtons.forEach((button) => button.addEventListener('click', () => updateStyle(button.dataset.aiStyle)));
    optionInputs.forEach((input) => input.addEventListener('change', updatePostPreview));
    languageSelect?.addEventListener('change', () => updateLanguage(languageSelect.value));
    agentSelect?.addEventListener('change', () => updateAgent(agentSelect.value));
    promptCategorySelect?.addEventListener('change', renderPromptLibrary);
    loadPromptButton?.addEventListener('click', async () => {
      if (!(await core.requirePremium(['aiLabPromptLibrary', 'Unlimited Prompt Library']))) {
        return;
      }
      const prompt = library.prompts(promptCategorySelect.value)[0];
      if (prompt && topicInput) {
        topicInput.value = prompt;
        setStatus('Prompt loaded.');
      }
    });
    form?.addEventListener('submit', generateSelected);
    document.querySelector('[data-ai-post-generate]')?.addEventListener('click', generateXPost);
    document.querySelector('[data-ai-favorite]')?.addEventListener('click', saveFavorite);
    document.querySelectorAll('[data-ai-remix]').forEach((button) => {
      button.addEventListener('click', () => remixOutput(button.dataset.aiRemix));
    });
    document.querySelectorAll('[data-ai-copy]').forEach((button) => {
      button.addEventListener('click', () => {
        const text = button.dataset.aiCopy === 'post' ? state.finalPost : state.resultText;
        copyText(text, button.dataset.aiCopy === 'post' ? 'X post copied.' : 'Output copied.');
      });
    });
    saveMemoryButton?.addEventListener('click', saveMemory);
    savePersonaButton?.addEventListener('click', savePersona);
    personaSelect?.addEventListener('change', renderPersonas);
    historySearch?.addEventListener('input', renderMemory);
    [outputHistoryTarget, postHistoryTarget, favoritesTarget].forEach((target) => {
      target?.addEventListener('click', restoreEntry);
    });
  }

  async function initAiLab() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    if (window.B20UI && typeof window.B20UI.initReveal === 'function') {
      window.B20UI.initReveal();
    }

    initControls();
    bindEvents();
    setBusy(false);
    setStatus('Engine idle.');
    await core.initPremium();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.B20AccessGate) {
      initAiLab();
      return;
    }

    window.B20AccessGate.init({
      enabled: accessGateEnabled,
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
