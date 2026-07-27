(function () {
  const accessGateEnabled = false;
  const features = window.B20AiFeatures;
  const storage = window.B20AiStorage;
  const preview = window.B20AiPreview;
  const core = window.B20AiCore;
  const generator = window.B20AiGenerator;
  const library = window.B20AiLibrary;
  const dom = window.B20AiRenderDom;
  const renderThread = window.B20AiRenderThread;
  const renderReplies = window.B20AiRenderReplies;
  const renderSummary = window.B20AiRenderSummary;
  const renderCampaign = window.B20AiRenderCampaign;
  const renderHistory = window.B20AiRenderHistory;

  const state = {
    mode: features.normalizeMode(storage.readPreference(storage.keys.mode, 'signal')),
    style: features.normalizeStyle(storage.readPreference(storage.keys.style, 'builder')),
    language: features.normalizeLanguage(storage.readPreference(storage.keys.language, 'auto')),
    agent: features.normalizeAgent(storage.readPreference(storage.keys.agent, 'builder')),
    count: 4,
    topic: '',
    signal: null,
    post: null,
    thread: [],
    emojis: [],
    replies: [],
    quote: null,
    campaign: null,
    summary: null,
    hashtags: [],
    analysis: null,
    preview: '',
    activeEntry: null,
    abortController: null,
    threadReplyTargets: {},
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
  const resultContainer = document.querySelector('[data-ai-result-container]');
  const resultActions = document.querySelector('[data-ai-result-actions]');
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
  const librarySearch = document.querySelector('[data-ai-library-search]');
  const loadPromptButton = document.querySelector('[data-ai-load-prompt]');
  const customPromptInput = document.querySelector('[data-ai-custom-prompt]');
  const saveCustomPromptButton = document.querySelector('[data-ai-save-prompt]');
  const memoryForm = document.querySelector('[data-ai-memory-form]');
  const saveMemoryButton = document.querySelector('[data-ai-save-memory]');
  const resetMemoryButton = document.querySelector('[data-ai-reset-memory]');
  const exportMemoryButton = document.querySelector('[data-ai-export-memory]');
  const importMemoryButton = document.querySelector('[data-ai-import-memory]');
  const personaSelect = document.querySelector('[data-ai-persona]');
  const personaNameInput = document.querySelector('[data-ai-persona-name]');
  const personaGuidanceInput = document.querySelector('[data-ai-persona-guidance]');
  const savePersonaButton = document.querySelector('[data-ai-save-persona]');
  const duplicatePersonaButton = document.querySelector('[data-ai-duplicate-persona]');
  const deletePersonaButton = document.querySelector('[data-ai-delete-persona]');
  const exportPersonasButton = document.querySelector('[data-ai-export-personas]');
  const importPersonasButton = document.querySelector('[data-ai-import-personas]');
  const historySearch = document.querySelector('[data-ai-history-search]');
  const outputHistoryTarget = document.querySelector('[data-ai-output-history]');
  const postHistoryTarget = document.querySelector('[data-ai-post-history]');
  const favoritesTarget = document.querySelector('[data-ai-favorites]');

  const remixModes = [
    'Shorter',
    'Longer',
    'Technical',
    'Funny',
    'Builder',
    'Professional',
    'More Viral',
    'Less Promotional',
    'Founder',
    'Minimal'
  ];

  const sectionKeys = {
    summary: 'summary',
    'generated post': 'post',
    post: 'post',
    'bullet list': 'bullets',
    bullets: 'bullets',
    'builder notes': 'notes',
    buildernotes: 'notes',
    builderNotes: 'notes',
    notes: 'notes'
  };

  const campaignLabels = {
    launchPost: 'Launch',
    launchThread: 'Thread',
    replies: 'Replies',
    quoteTweet: 'Quote',
    followUp: 'Follow-up',
    reminder: 'Reminder',
    lastChance: 'Last Chance',
    finalUpdate: 'Final Update'
  };

  function setStatus(text) {
    if (statusTarget) {
      statusTarget.textContent = text;
    }
  }

  function setBusy(isBusy, label) {
    const buttons = [
      submitButton,
      ...Array.from(document.querySelectorAll('[data-ai-action], [data-ai-copy], [data-ai-load-prompt], [data-ai-save-prompt], [data-ai-save-memory], [data-ai-save-persona]'))
    ];

    buttons.forEach((button) => {
      if (button) {
        button.disabled = isBusy;
      }
    });

    if (engineState) {
      engineState.textContent = isBusy ? label || 'WORKING' : 'ONLINE';
      engineState.classList.toggle('is-busy', isBusy);
    }
  }

  function showContent() {
    const gate = document.querySelector('[data-ai-gate]');
    const content = document.querySelector('[data-ai-content]');
    if (gate) gate.hidden = true;
    if (content) content.hidden = false;
  }

  function initGate() {
    if (!accessGateEnabled) {
      showContent();
      return true;
    }

    if (!window.B20AccessGate) {
      showContent();
      return true;
    }

    const allowed = window.B20AccessGate.protect({
      gateSelector: '[data-ai-gate]',
      contentSelector: '[data-ai-content]',
      formSelector: '[data-ai-gate-form]',
      inputSelector: '[data-ai-password]',
      errorSelector: '[data-ai-gate-error]',
      storageKey: 'b20-ai-lab-access',
      password: '0xb20.lol'
    });

    return allowed;
  }

  function currentModeConfig() {
    return features.modes.find((mode) => mode.id === state.mode) || features.modes[0];
  }

  function currentMemory() {
    return storage.readMemory();
  }

  function customPersonas() {
    return storage.readList(storage.keys.personas);
  }

  function selectedPersona() {
    const custom = customPersonas();
    const all = [...features.defaultPersonas, ...custom];
    return all.find((persona) => persona.id === personaSelect?.value) || all.find((persona) => persona.id === state.agent) || all[0];
  }

  function selectedOptions() {
    return optionInputs.reduce((options, input) => {
      options[input.dataset.aiOption] = input.checked;
      return options;
    }, {});
  }

  function makeAbortSignal() {
    if (state.abortController) {
      state.abortController.abort();
    }
    state.abortController = new AbortController();
    return state.abortController.signal;
  }

  function releaseAbort() {
    state.abortController = null;
  }

  function requestState(signal) {
    state.topic = (topicInput?.value || '').trim();
    const persona = selectedPersona();
    return {
      mode: state.mode,
      action: currentModeConfig().action,
      topic: state.topic,
      style: state.style,
      language: state.language,
      agent: state.agent,
      count: Number(state.count || 4),
      options: selectedOptions(),
      memory: currentMemory(),
      persona,
      abortSignal: signal
    };
  }

  function outputId(prefix) {
    return `${prefix.toUpperCase()} #${String(Math.floor(Math.random() * 90000) + 10000)}`;
  }

  function ensureArray(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).map(String);
    }
    if (typeof value === 'string' && value.trim()) {
      return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  function stripThreadNumber(value) {
    return String(value || '')
      .trim()
      .replace(/^\s*(?:tweet\s*)?\d+\s*\/\s*\d+\s*[:.)-]?\s*/i, '')
      .replace(/^\s*(?:tweet\s*)?\d+\s*[:.)-]\s*/i, '')
      .trim();
  }

  function cleanThreadItems(items = state.thread) {
    return ensureArray(items).map(stripThreadNumber).filter(Boolean);
  }

  function appendIfFits(base, addition) {
    const cleanBase = String(base || '').trim();
    const cleanAddition = String(addition || '').trim();
    if (!cleanAddition) return cleanBase;

    const candidate = `${cleanBase}\n\n${cleanAddition}`.trim();
    return candidate.length <= preview.postLimit ? candidate : cleanBase;
  }

  function threadTweetText(index) {
    const items = cleanThreadItems();
    const base = items[index] || '';
    if (!base || index !== items.length - 1) return base;

    const options = selectedOptions();
    let output = base;

    if (options.emojis && state.emojis.length) {
      const emojiText = state.emojis.slice(0, 3).join(' ');
      const inlineCandidate = `${output} ${emojiText}`.trim();
      output = inlineCandidate.length <= preview.postLimit ? inlineCandidate : output;
    }

    if (options.hashtags && state.hashtags.length) {
      output = appendIfFits(output, state.hashtags.slice(0, 5).join(' '));
    }

    if (options.attribution) {
      output = appendIfFits(output, 'Generated with https://0xb20.lol/ai');
    }

    return output;
  }

  function threadPayload() {
    const items = cleanThreadItems().map((_, index) => threadTweetText(index));
    return {
      items,
      hashtags: state.hashtags,
      emojis: state.emojis,
      replyTargets: state.threadReplyTargets
    };
  }

  function payloadForMode() {
    if (state.mode === 'thread') return threadPayload();
    if (state.mode === 'replies') return { items: state.replies };
    if (state.mode === 'campaign') return { campaign: state.campaign || {} };
    if (state.mode === 'summary') return state.summary || {};
    if (state.mode === 'hashtags') return { hashtags: state.hashtags };
    if (state.mode === 'quote') return { post: state.quote || '' };
    return { signal: state.signal || '' };
  }

  function textForMode(mode = state.mode, payload = payloadForMode()) {
    return preview.formatPayload(payload, mode);
  }

  function clearNode(node) {
    if (node) {
      node.innerHTML = '';
    }
  }

  function createAction(label, action, data = {}) {
    return dom.button(label, action, data);
  }

  function appendActions(actions) {
    clearNode(resultActions);
    if (!resultActions) return;
    actions.filter(Boolean).forEach((button) => resultActions.append(button));
  }

  function primaryActions() {
    if (state.mode === 'thread') {
      return [
        createAction('Copy Thread', 'copy-thread'),
        createAction('Publish Thread', 'publish-thread'),
        createAction('Save Favourite', 'save-favorite')
      ];
    }

    if (state.mode === 'replies') {
      return [
        createAction('Copy Replies', 'copy-replies'),
        createAction('Generate More', 'generate-more-replies'),
        createAction('Save Favourite', 'save-favorite')
      ];
    }

    if (state.mode === 'campaign') {
      return [
        createAction('Copy Campaign', 'copy-campaign'),
        createAction('Save Favourite', 'save-favorite')
      ];
    }

    if (state.mode === 'summary') {
      return [
        createAction('Copy Summary', 'copy-summary'),
        createAction('Copy Builder Notes', 'copy-builder-notes'),
        createAction('Generate X Post', 'generate-post'),
        createAction('Save Favourite', 'save-favorite')
      ];
    }

    if (state.mode === 'hashtags') {
      return [
        createAction('Copy Tags', 'copy-hashtags'),
        createAction('Regenerate', 'regenerate-hashtags'),
        createAction('Save Favourite', 'save-favorite')
      ];
    }

    return [
      createAction('Copy Output', 'copy-output'),
      ...remixModes.map((mode) => createAction(mode, 'remix-output', { aiRemixMode: mode.toLowerCase() })),
      createAction('Save Favourite', 'save-favorite'),
      createAction('Generate X Post', 'generate-post')
    ];
  }

  function renderHashtags() {
    const grid = dom.el('div', 'ai-hashtag-grid');
    if (!state.hashtags.length) {
      grid.append(dom.el('p', 'ai-memory-empty', 'No hashtags generated.'));
      return grid;
    }

    state.hashtags.forEach((tag) => {
      const clean = tag.startsWith('#') ? tag : `#${tag}`;
      const pill = dom.el('button', 'ai-hashtag-pill', clean);
      pill.type = 'button';
      pill.dataset.aiAction = 'copy-hashtag';
      pill.dataset.aiValue = clean;
      grid.append(pill);
    });
    return grid;
  }

  function renderSimpleOutput(text) {
    const block = dom.textBlock(text || 'No output generated.', 'ai-content-block ai-output-text');
    return block;
  }

  function renderCurrent(remember = true) {
    if (!outputTarget || !resultCard || !resultContainer) return;
    outputTarget.hidden = false;
    resultCard.hidden = false;
    clearNode(resultContainer);

    const payload = payloadForMode();
    const text = textForMode(state.mode, payload);
    if (resultKicker) {
      resultKicker.textContent = outputId(currentModeConfig().label);
    }

    if (state.mode === 'thread') {
      renderThread.render(resultContainer, payload);
    } else if (state.mode === 'replies') {
      renderReplies.render(resultContainer, payload);
    } else if (state.mode === 'campaign') {
      renderCampaign.render(resultContainer, payload);
    } else if (state.mode === 'summary') {
      renderSummary.render(resultContainer, payload);
    } else if (state.mode === 'hashtags') {
      resultContainer.append(renderHashtags());
    } else {
      resultContainer.append(renderSimpleOutput(text));
    }

    appendActions(primaryActions());
    state.activeEntry = buildEntry('output');

    if (remember && text.trim()) {
      storage.remember(storage.keys.outputs, state.activeEntry, 20);
      renderStoredLists();
    }
  }

  function buildEntry(kind) {
    const payload = payloadForMode();
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      mode: state.mode,
      topic: state.topic,
      style: state.style,
      language: state.language,
      agent: state.agent,
      payload,
      postPayload: state.post ? { ...state.post } : null,
      preview: state.preview,
      analysis: state.analysis,
      text: textForMode(state.mode, payload),
      createdAt: new Date().toISOString()
    };
  }

  function currentSourceText() {
    if (state.mode === 'summary' && state.summary?.post) return state.summary.post;
    if (state.mode === 'quote') return state.quote || '';
    if (state.mode === 'signal') return state.signal || '';
    return textForMode();
  }

  function renderPost(payload, remember = true) {
    const finalPost = preview.assemblePost(payload, selectedOptions());
    state.post = payload;
    state.preview = finalPost;
    state.analysis = preview.analyze(finalPost);

    if (!postCard || !postText) return;
    outputTarget.hidden = false;
    postCard.hidden = false;
    postText.textContent = finalPost || 'Transmission unavailable.';

    if (counterTarget) {
      counterTarget.textContent = `${finalPost.length} / ${preview.postLimit}`;
      counterTarget.classList.toggle('is-over', finalPost.length > preview.postLimit);
    }

    dom.renderAnalysis(analysisTarget, finalPost);

    if (publishLink) {
      publishLink.hidden = finalPost.length === 0 || finalPost.length > preview.postLimit;
      publishLink.href = preview.tweetIntent(finalPost);
    }

    if (remember && finalPost.trim()) {
      storage.remember(storage.keys.posts, {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        kind: 'post',
        mode: state.mode,
        topic: state.topic,
        payload,
        text: finalPost,
        analysis: state.analysis,
        createdAt: new Date().toISOString()
      }, 10);
      renderStoredLists();
    }
  }

  function hidePost() {
    if (postCard) postCard.hidden = true;
    state.post = null;
    state.preview = '';
    state.analysis = null;
  }

  async function copyText(text, success = 'Copied.') {
    if (!text || !text.trim()) {
      setStatus('Nothing to copy.');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus(success);
      return true;
    } catch (error) {
      setStatus('Clipboard unavailable. Select and copy manually.');
      return false;
    }
  }

  function publishText(text) {
    if (!text || !text.trim()) {
      setStatus('Nothing to publish.');
      return;
    }
    window.open(preview.tweetIntent(text), '_blank', 'noopener,noreferrer');
  }

  async function publishThread() {
    const items = cleanThreadItems().map((_, index) => threadTweetText(index));
    if (!items.length) {
      setStatus('No thread available.');
      return;
    }
    setStatus('Opening thread starter. Paste the published tweet link back into the next step.');
    publishText(items[0]);
  }

  function extractTweetId(url) {
    const source = String(url || '').trim();
    const match = source.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i) || source.match(/\b(\d{10,})\b/);
    return match ? match[1] : '';
  }

  function publishThreadReply(index) {
    const tweetId = extractTweetId(state.threadReplyTargets[index]);
    const text = threadTweetText(index);

    if (!text) {
      setStatus('No tweet available.');
      return;
    }

    if (!tweetId) {
      setStatus(`Paste tweet ${index} link before publishing tweet ${index + 1}.`);
      return;
    }

    window.open(`${preview.tweetIntent(text)}&in_reply_to=${encodeURIComponent(tweetId)}`, '_blank', 'noopener,noreferrer');
    setStatus(`Opening tweet ${index + 1} as thread reply.`);
  }

  function summarySectionText(section) {
    const key = sectionKeys[String(section || '').toLowerCase()] || section;
    const value = state.summary?.[key];
    if (Array.isArray(value)) return value.map((item) => `• ${item}`).join('\n');
    return String(value || '');
  }

  function campaignSectionText(section) {
    const value = state.campaign?.[section];
    if (Array.isArray(value)) return value.join('\n\n');
    return String(value || '');
  }

  function collectCurrentCopy() {
    if (state.mode === 'thread') return cleanThreadItems().map((_, index) => threadTweetText(index)).join('\n\n');
    if (state.mode === 'replies') return ensureArray(state.replies).join('\n\n');
    if (state.mode === 'campaign') return renderCampaign.text({ campaign: state.campaign || {} });
    if (state.mode === 'summary') return renderSummary.text(state.summary || {});
    if (state.mode === 'hashtags') return state.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
    return currentSourceText();
  }

  function updateMode(mode) {
    state.mode = features.normalizeMode(mode);
    storage.writePreference(storage.keys.mode, state.mode);

    const config = currentModeConfig();
    if (primaryLabel) primaryLabel.textContent = config.label;
    if (topicInput) topicInput.placeholder = config.placeholder;
    if (submitButton) submitButton.textContent = `Generate ${config.label.replace(' Generator', '')}`;
    if (contextHelp) {
      contextHelp.textContent = state.mode === 'summary'
        ? 'Paste article, long post, notes or research material.'
        : state.mode === 'replies'
          ? 'Paste a post, X URL, or the idea you want to reply to.'
          : 'Examples: builders, airdrops, fear, liquidity, Base, memecoins, decentralization, AI, crypto, markets';
    }

    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.aiMode === state.mode);
    });
  }

  function updateStyle(style) {
    state.style = features.normalizeStyle(style);
    storage.writePreference(storage.keys.style, state.style);
    styleButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.aiStyle === state.style);
    });
  }

  function hydrateSelect(select, entries, value) {
    if (!select) return;
    select.innerHTML = entries.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
    select.value = value;
  }

  function hydrateControls() {
    hydrateSelect(languageSelect, features.languages, state.language);
    hydrateSelect(agentSelect, features.agents, state.agent);
    if (countSelect) countSelect.value = String(state.count);
    updateMode(state.mode);
    updateStyle(state.style);
  }

  function readPromptGroups() {
    const builtIn = library.categories().map((name) => [name, library.prompts(name)]);
    const custom = storage.readCustomPrompts().map((entry) => entry.text);
    const recent = storage.readJson(storage.keys.promptRecent, []);
    const usage = storage.readPromptUsage();
    const mostUsed = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([text]) => text);

    return new Map([
      ...builtIn,
      ['Custom', custom],
      ['Recent', recent],
      ['Most Used', mostUsed]
    ]);
  }

  function hydratePromptCategories() {
    if (!promptCategorySelect) return;
    const groups = readPromptGroups();
    const current = promptCategorySelect.value;
    promptCategorySelect.innerHTML = Array.from(groups.keys())
      .map((name) => `<option value="${name}">${name}</option>`)
      .join('');
    promptCategorySelect.value = groups.has(current) ? current : 'Launch';
  }

  function renderPromptLibrary() {
    if (!promptList) return;
    hydratePromptCategories();
    const groups = readPromptGroups();
    const category = promptCategorySelect?.value || 'Launch';
    const search = (librarySearch?.value || '').toLowerCase();
    const prompts = (groups.get(category) || []).filter((prompt) => prompt.toLowerCase().includes(search));
    promptList.innerHTML = '';

    if (!prompts.length) {
      promptList.append(dom.el('p', 'ai-memory-empty', 'No prompts found.'));
      return;
    }

    prompts.forEach((prompt) => {
      const row = dom.el('div', 'ai-memory-row');
      const load = dom.el('button', 'ai-memory-item', prompt);
      load.type = 'button';
      load.dataset.aiAction = 'load-prompt';
      load.dataset.aiPrompt = prompt;
      row.append(load);

      if (category === 'Custom') {
        const remove = createAction('Delete', 'delete-custom-prompt', { aiPrompt: prompt });
        row.append(remove);
      }

      promptList.append(row);
    });
  }

  function loadPrompt(prompt) {
    if (!topicInput || !prompt) return;
    topicInput.value = prompt;
    autosizeTextarea(topicInput);
    storage.rememberPrompt(prompt);
    renderPromptLibrary();
    setStatus('Prompt loaded.');
  }

  async function loadPromptFromLibrary(prompt) {
    const allowed = await core.requirePremium(['aiLabPromptLibrary', 'Unlimited Prompt Library']);
    if (!allowed) {
      setStatus('Prompt Library requires active Lab Pass.');
      return;
    }
    loadPrompt(prompt);
  }

  function saveCustomPrompt() {
    const text = (customPromptInput?.value || '').trim();
    if (!text) {
      setStatus('Custom prompt is empty.');
      return;
    }
    storage.saveCustomPrompt(text);
    if (customPromptInput) customPromptInput.value = '';
    renderPromptLibrary();
    setStatus('Custom prompt saved.');
  }

  function hydrateMemoryForm() {
    const memory = currentMemory();
    if (!memoryForm) return;
    memoryForm.querySelectorAll('[data-ai-memory-field]').forEach((input) => {
      input.value = memory[input.dataset.aiMemoryField] || '';
    });
  }

  function collectMemoryForm() {
    const memory = {};
    if (!memoryForm) return memory;
    memoryForm.querySelectorAll('[data-ai-memory-field]').forEach((input) => {
      memory[input.dataset.aiMemoryField] = input.value.trim();
    });
    return memory;
  }

  function saveMemory() {
    storage.saveMemory(collectMemoryForm());
    setStatus('Project memory saved.');
  }

  function resetMemory() {
    storage.saveMemory({});
    hydrateMemoryForm();
    setStatus('Project memory reset.');
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function importJson(handler) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.className = 'ai-hidden-file';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        handler(JSON.parse(await file.text()));
      } catch (error) {
        setStatus('JSON import failed.');
      } finally {
        input.remove();
      }
    });
    document.body.append(input);
    input.click();
  }

  function renderPersonas() {
    if (!personaSelect) return;
    const all = [...features.defaultPersonas, ...customPersonas()];
    const selected = personaSelect.value || 'default';
    personaSelect.innerHTML = all.map((persona) => `<option value="${persona.id}">${persona.name}</option>`).join('');
    personaSelect.value = all.some((persona) => persona.id === selected) ? selected : 'default';
    syncPersonaFields();
  }

  function syncPersonaFields() {
    const persona = selectedPersona();
    if (personaNameInput) personaNameInput.value = persona.id?.startsWith('custom-') ? persona.name : '';
    if (personaGuidanceInput) personaGuidanceInput.value = persona.guidance || '';
  }

  function savePersona() {
    const name = (personaNameInput?.value || '').trim();
    const guidance = (personaGuidanceInput?.value || '').trim();
    if (!name || !guidance) {
      setStatus('Persona needs name and rules.');
      return;
    }
    const current = personaSelect?.value || '';
    const personas = customPersonas();
    const id = current.startsWith('custom-') ? current : `custom-${Date.now()}`;
    const next = personas.filter((persona) => persona.id !== id);
    next.push({ id, name, guidance });
    storage.writePersonas(next);
    renderPersonas();
    if (personaSelect) personaSelect.value = id;
    setStatus('Persona saved.');
  }

  function duplicatePersona() {
    const persona = selectedPersona();
    if (!persona) return;
    const copy = {
      id: `custom-${Date.now()}`,
      name: `${persona.name} Copy`,
      guidance: persona.guidance
    };
    storage.writePersonas([...customPersonas(), copy]);
    renderPersonas();
    if (personaSelect) personaSelect.value = copy.id;
    syncPersonaFields();
    setStatus('Persona duplicated.');
  }

  function deletePersona() {
    const id = personaSelect?.value || '';
    if (!id.startsWith('custom-')) {
      setStatus('Default personas cannot be deleted.');
      return;
    }
    storage.deletePersona(id);
    renderPersonas();
    setStatus('Custom persona deleted.');
  }

  function renderStoredLists() {
    const search = historySearch?.value || '';
    if (renderHistory) {
      renderHistory.renderList(outputHistoryTarget, storage.readList(storage.keys.outputs, 20), 'No outputs generated yet.', 'output', search);
      renderHistory.renderList(postHistoryTarget, storage.readList(storage.keys.posts, 10), 'No transmissions yet.', 'post', search);
      renderHistory.renderList(favoritesTarget, storage.readList(storage.keys.favorites, 10), 'No favourites saved.', 'favorite', search);
    }
  }

  function restoreEntry(entry) {
    if (!entry) return;
    updateMode(entry.mode || 'signal');
    updateStyle(entry.style || state.style);
    state.language = features.normalizeLanguage(entry.language || state.language);
    state.agent = features.normalizeAgent(entry.agent || state.agent);
    if (languageSelect) languageSelect.value = state.language;
    if (agentSelect) agentSelect.value = state.agent;
    if (topicInput) {
      topicInput.value = entry.topic || '';
      autosizeTextarea(topicInput);
    }

    const payload = entry.payload || {};
    state.signal = payload.signal || payload.post || entry.text || null;
    state.thread = ensureArray(payload.items);
    state.emojis = ensureArray(payload.emojis);
    state.replies = state.mode === 'replies' ? ensureArray(payload.items) : [];
    state.quote = payload.post || payload.signal || entry.text || null;
    state.campaign = payload.campaign || null;
    state.summary = state.mode === 'summary' ? payload : null;
    state.hashtags = ensureArray(payload.hashtags);
    state.threadReplyTargets = payload.replyTargets || {};
    state.post = entry.postPayload || null;
    state.preview = entry.preview || '';
    state.analysis = entry.analysis || null;

    renderCurrent(false);
    if (entry.kind === 'post' || entry.postPayload || entry.preview) {
      renderPost(entry.postPayload || { post: entry.text || entry.preview || '', hashtags: [], emojis: [] }, false);
    }
    setStatus('Stored output restored.');
  }

  function findStoredEntry(id, type) {
    const key = type === 'post' ? storage.keys.posts : type === 'favorite' ? storage.keys.favorites : storage.keys.outputs;
    return storage.readList(key, 30).find((entry) => entry.id === id);
  }

  function saveFavorite() {
    const entry = buildEntry('favorite');
    storage.remember(storage.keys.favorites, entry, 10);
    renderStoredLists();
    setStatus('Favorite saved.');
  }

  function applyPayload(payload) {
    hidePost();

    if (state.mode === 'thread') {
      state.thread = ensureArray(payload.thread || payload.items);
      state.hashtags = ensureArray(payload.hashtags);
      state.emojis = ensureArray(payload.emojis);
      state.threadReplyTargets = {};
      if (!state.thread.length) throw new Error('Thread response malformed.');
      return;
    }

    if (state.mode === 'replies') {
      state.replies = ensureArray(payload.replies || payload.items);
      state.hashtags = ensureArray(payload.hashtags);
      state.emojis = ensureArray(payload.emojis);
      if (!state.replies.length) throw new Error('Replies response malformed.');
      return;
    }

    if (state.mode === 'campaign') {
      state.campaign = payload.campaign || payload;
      if (!state.campaign || typeof state.campaign !== 'object') throw new Error('Campaign response malformed.');
      return;
    }

    if (state.mode === 'summary') {
      state.summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : payload;
      if (!state.summary || typeof state.summary !== 'object') throw new Error('Summary response malformed.');
      return;
    }

    if (state.mode === 'hashtags') {
      state.hashtags = ensureArray(payload.hashtags);
      if (!state.hashtags.length) throw new Error('Hashtag response malformed.');
      return;
    }

    if (state.mode === 'quote') {
      state.quote = payload.post || payload.signal || payload.quote || '';
      if (!state.quote.trim()) throw new Error('Quote response malformed.');
      return;
    }

    state.signal = payload.signal || payload.post || '';
    if (!state.signal.trim()) throw new Error('Signal response malformed.');
  }

  function loadingLabel() {
    if (state.mode === 'thread') return 'PREPARING THREAD';
    if (state.mode === 'replies') return 'PREPARING REPLIES';
    if (state.mode === 'campaign') return 'PREPARING CAMPAIGN';
    if (state.mode === 'summary') return 'ANALYZING';
    if (state.mode === 'hashtags') return 'PREPARING TAGS';
    return 'SYNTHESIZING';
  }

  async function generateSelected(event) {
    event?.preventDefault();
    const config = currentModeConfig();
    const topic = (topicInput?.value || '').trim();
    if (!topic) {
      setStatus('Input signal required.');
      topicInput?.focus();
      return;
    }

    try {
      setBusy(true, loadingLabel());
      setStatus(`${config.label} running...`);
      if (config.premium) {
        const allowed = await core.requirePremium(config.premium);
        if (!allowed) {
          setStatus(`${config.premium[1]} requires active Lab Pass.`);
          return;
        }
      }

      const signal = makeAbortSignal();
      const payload = await generator.generate(requestState(signal));
      applyPayload(payload);
      renderCurrent(true);
      setStatus(`${config.label} ready.`);
    } catch (error) {
      if (error.name === 'AbortError') {
        setStatus('Previous request aborted.');
      } else {
        setStatus(error.message || 'Synthesis failed. Existing output preserved.');
      }
    } finally {
      releaseAbort();
      setBusy(false);
    }
  }

  async function generatePost(sourceText) {
    if (state.mode === 'thread') {
      publishThread();
      return;
    }
    if (state.mode === 'hashtags') {
      setStatus('Hashtag mode has no X post conversion.');
      return;
    }

    const source = sourceText || currentSourceText();
    if (!source.trim()) {
      setStatus('Generate an output first.');
      return;
    }

    try {
      setBusy(true, 'PREPARING TRANSMISSION');
      setStatus('Preparing X transmission...');
      const signal = makeAbortSignal();
      const payload = await generator.generatePost(requestState(signal), source);
      if (!payload.post || !String(payload.post).trim()) {
        throw new Error('Transmission response malformed.');
      }
      renderPost(payload, true);
      setStatus('Transmission ready.');
    } catch (error) {
      setStatus(error.name === 'AbortError' ? 'Transmission aborted.' : error.message || 'Transmission failed. Existing output preserved.');
    } finally {
      releaseAbort();
      setBusy(false);
    }
  }

  async function remixText(source, remixMode) {
    const original = String(source || '');
    if (!original.trim()) {
      setStatus('Nothing to remix.');
      return original;
    }

    const allowed = await core.requirePremium(['aiLabAdvancedRemix', 'Advanced Remix']);
    if (!allowed) {
      setStatus('Advanced Remix requires active Lab Pass.');
      return original;
    }

    let latest = original;
    for (let attempt = 0; attempt < 2; attempt++) {
      const signal = makeAbortSignal();
      const payload = await generator.remix(requestState(signal), latest, remixMode);
      const next = payload.signal || payload.post || payload.text || '';
      if (preview.isMeaningfullyDifferent(original, next)) {
        return next;
      }
      latest = `${original}\n\nChange the angle completely.`;
    }

    throw new Error('Remix did not change enough. Try another angle.');
  }

  async function remixOutput(mode) {
    try {
      setBusy(true, 'REMIXING');
      setStatus('Remixing output...');
      const next = await remixText(currentSourceText(), mode);
      if (state.mode === 'quote') state.quote = next;
      else state.signal = next;
      renderCurrent(true);
      setStatus('Remix ready.');
    } catch (error) {
      setStatus(error.message || 'Remix failed.');
    } finally {
      releaseAbort();
      setBusy(false);
    }
  }

  async function remixArrayItem(type, index, mode) {
    const list = type === 'thread' ? state.thread : state.replies;
    if (!list[index]) return;
    try {
      setBusy(true, 'REMIXING');
      const next = await remixText(list[index], mode);
      list[index] = next;
      renderCurrent(true);
      setStatus('Item remixed.');
    } catch (error) {
      setStatus(error.message || 'Remix failed.');
    } finally {
      releaseAbort();
      setBusy(false);
    }
  }

  async function remixSummarySection(section, mode) {
    const key = sectionKeys[String(section || '').toLowerCase()] || section;
    const source = summarySectionText(key);
    try {
      setBusy(true, 'REMIXING');
      const next = await remixText(source, mode);
      if (Array.isArray(state.summary?.[key])) {
        state.summary[key] = next.split(/\n+/).map((item) => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
      } else {
        state.summary[key] = next;
      }
      renderCurrent(true);
      setStatus('Section remixed.');
    } catch (error) {
      setStatus(error.message || 'Remix failed.');
    } finally {
      releaseAbort();
      setBusy(false);
    }
  }

  async function remixCampaignSection(section, mode) {
    const source = campaignSectionText(section);
    try {
      setBusy(true, 'REMIXING');
      const next = await remixText(source, mode);
      if (Array.isArray(state.campaign?.[section])) {
        state.campaign[section] = next.split(/\n+/).map((item) => item.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
      } else {
        state.campaign[section] = next;
      }
      renderCurrent(true);
      setStatus(`${campaignLabels[section] || 'Campaign block'} remixed.`);
    } catch (error) {
      setStatus(error.message || 'Remix failed.');
    } finally {
      releaseAbort();
      setBusy(false);
    }
  }

  async function generateMoreReplies() {
    const previousCount = state.replies.length;
    const originalCount = state.count;
    state.count = Math.max(Number(originalCount || 5), 5);
    await generateSelected();
    if (state.replies.length <= previousCount) {
      setStatus('Replies refreshed.');
    }
    state.count = originalCount;
  }

  function publishCampaignSection(section) {
    publishText(campaignSectionText(section));
  }

  function copyCampaignItem(section, index) {
    const value = state.campaign?.[section];
    if (Array.isArray(value)) {
      copyText(String(value[index] || ''), 'Campaign item copied.');
    }
  }

  function autosizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 520)}px`;
  }

  function handleAction(button) {
    const action = button.dataset.aiAction;
    const index = Number(button.dataset.aiIndex);
    const section = button.dataset.aiSection;
    const mode = button.dataset.aiRemixMode || 'builder';

    if (action === 'copy-output') copyText(collectCurrentCopy(), 'Output copied.');
    if (action === 'copy-thread') copyText(cleanThreadItems().map((_, itemIndex) => threadTweetText(itemIndex)).join('\n\n'), 'Thread copied.');
    if (action === 'publish-thread') publishThread();
    if (action === 'copy-replies') copyText(ensureArray(state.replies).join('\n\n'), 'Replies copied.');
    if (action === 'copy-summary') copyText(summarySectionText('summary'), 'Summary copied.');
    if (action === 'copy-builder-notes') copyText(summarySectionText('builderNotes'), 'Builder notes copied.');
    if (action === 'copy-hashtags') copyText(state.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' '), 'Hashtags copied.');
    if (action === 'copy-hashtag') copyText(button.dataset.aiValue || '', 'Hashtag copied.');
    if (action === 'save-favorite') saveFavorite();
    if (action === 'generate-post') generatePost();
    if (action === 'regenerate-hashtags') generateSelected();
    if (action === 'generate-more-replies') generateMoreReplies();
    if (action === 'remix-output') remixOutput(mode);
    if (action === 'copy-item') copyText((state.mode === 'thread' ? threadTweetText(index) : state.replies[index]) || '', 'Item copied.');
    if (action === 'publish-item') {
      if (state.mode === 'thread') {
        index === 0 ? publishThread() : publishThreadReply(index);
      } else {
        publishText(state.replies[index] || '');
      }
    }
    if (action === 'remix-item') remixArrayItem(state.mode === 'thread' ? 'thread' : 'replies', index, mode);
    if (action === 'copy-section') copyText(summarySectionText(section), 'Section copied.');
    if (action === 'remix-section') remixSummarySection(section, mode);
    if (action === 'copy-campaign') copyText(section ? campaignSectionText(section) : renderCampaign.text({ campaign: state.campaign || {} }), 'Campaign copied.');
    if (action === 'remix-campaign') remixCampaignSection(section, mode);
    if (action === 'preview-campaign') generatePost(campaignSectionText(section));
    if (action === 'copy-campaign-item') copyCampaignItem(button.dataset.aiSection, index);
    if (action === 'publish-campaign-item') {
      const value = state.campaign?.[button.dataset.aiSection];
      publishText(Array.isArray(value) ? value[index] : value);
    }
    if (action === 'load-prompt') loadPromptFromLibrary(button.dataset.aiPrompt);
    if (action === 'delete-custom-prompt') {
      storage.deleteCustomPrompt(button.dataset.aiPrompt);
      renderPromptLibrary();
      setStatus('Custom prompt deleted.');
    }
    if (action === 'restore') {
      restoreEntry(findStoredEntry(button.dataset.aiRestoreId, button.dataset.aiRestoreType));
    }
  }

  function bindEvents() {
    form?.addEventListener('submit', generateSelected);

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ai-action]');
      if (!button) return;
      event.preventDefault();
      if (button.disabled) return;
      handleAction(button);
    });

    document.addEventListener('input', (event) => {
      const input = event.target.closest('[data-ai-thread-target]');
      if (!input) return;

      const index = Number(input.dataset.aiThreadTarget);
      state.threadReplyTargets[index] = input.value.trim();

      const card = input.closest('.ai-output-subcard');
      const button = card?.querySelector(`[data-ai-action="publish-item"][data-ai-index="${index}"]`);
      const enabled = Boolean(extractTweetId(input.value));
      if (button) button.disabled = !enabled;
      input.classList.toggle('is-invalid', input.value.trim().length > 0 && !enabled);
    });

    modeButtons.forEach((button) => button.addEventListener('click', () => updateMode(button.dataset.aiMode)));
    styleButtons.forEach((button) => button.addEventListener('click', () => updateStyle(button.dataset.aiStyle)));

    languageSelect?.addEventListener('change', () => {
      state.language = features.normalizeLanguage(languageSelect.value);
      storage.writePreference(storage.keys.language, state.language);
    });

    agentSelect?.addEventListener('change', () => {
      state.agent = features.normalizeAgent(agentSelect.value);
      storage.writePreference(storage.keys.agent, state.agent);
    });

    countSelect?.addEventListener('change', () => {
      state.count = Number(countSelect.value || 4);
    });

    topicInput?.addEventListener('input', () => autosizeTextarea(topicInput));
    topicInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        generateSelected(event);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.abortController) {
        state.abortController.abort();
        setStatus('Request aborted.');
      }
    });

    loadPromptButton?.addEventListener('click', async () => {
      const allowed = await core.requirePremium(['aiLabPromptLibrary', 'Unlimited Prompt Library']);
      if (!allowed) {
        setStatus('Prompt Library requires active Lab Pass.');
        return;
      }
      const firstPrompt = promptList?.querySelector('[data-ai-prompt]')?.dataset.aiPrompt;
      loadPrompt(firstPrompt);
    });

    promptCategorySelect?.addEventListener('change', renderPromptLibrary);
    librarySearch?.addEventListener('input', renderPromptLibrary);
    saveCustomPromptButton?.addEventListener('click', saveCustomPrompt);
    saveMemoryButton?.addEventListener('click', saveMemory);
    resetMemoryButton?.addEventListener('click', resetMemory);
    exportMemoryButton?.addEventListener('click', () => downloadJson('0xb20-ai-memory.json', currentMemory()));
    importMemoryButton?.addEventListener('click', () => importJson((json) => {
      storage.saveMemory(json && typeof json === 'object' ? json : {});
      hydrateMemoryForm();
      setStatus('Project memory imported.');
    }));

    personaSelect?.addEventListener('change', syncPersonaFields);
    savePersonaButton?.addEventListener('click', savePersona);
    duplicatePersonaButton?.addEventListener('click', duplicatePersona);
    deletePersonaButton?.addEventListener('click', deletePersona);
    exportPersonasButton?.addEventListener('click', () => downloadJson('0xb20-ai-personas.json', customPersonas()));
    importPersonasButton?.addEventListener('click', () => importJson((json) => {
      const personas = Array.isArray(json) ? json.filter((item) => item && item.name && item.guidance).map((item, index) => ({
        id: item.id?.startsWith('custom-') ? item.id : `custom-${Date.now()}-${index}`,
        name: String(item.name),
        guidance: String(item.guidance)
      })) : [];
      storage.writePersonas(personas);
      renderPersonas();
      setStatus('Personas imported.');
    }));

    historySearch?.addEventListener('input', renderStoredLists);

    document.querySelector('[data-ai-copy="post"]')?.addEventListener('click', () => copyText(state.preview, 'X post copied.'));

    optionInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (state.post) {
          renderPost(state.post, false);
          setStatus('Preview updated.');
        }
      });
    });
  }

  async function initPremium() {
    try {
      await core.initPremium();
    } catch (error) {
      setStatus('Lab Pass status unavailable. Free tools remain active.');
    }
  }

  function init() {
    if (!features || !storage || !preview || !core || !generator || !library || !dom) {
      return;
    }

    if (!initGate()) {
      return;
    }

    hydrateControls();
    hydrateMemoryForm();
    renderPersonas();
    renderPromptLibrary();
    renderStoredLists();
    bindEvents();
    initPremium();
    setStatus('Engine idle.');
    if (engineState) engineState.textContent = 'ONLINE';
    state.initialized = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
