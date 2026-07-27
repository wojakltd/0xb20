(function (global) {
  function buildContext(state) {
    return {
      mode: state.mode,
      topic: state.topic,
      style: state.style,
      language: state.language,
      agent: state.agent,
      count: state.count,
      memory: state.memory,
      persona: state.persona,
      options: state.options
    };
  }

  async function generate(state) {
    const features = global.B20AiFeatures;
    const mode = features.byId(features.modes, state.mode);
    const unlocked = await global.B20AiCore.requirePremium(mode.premium);

    if (!unlocked) {
      throw new Error('Lab Pass required for this Laboratory module.');
    }

    return global.B20AiCore.request({
      action: mode.action,
      ...buildContext(state)
    });
  }

  async function generatePost(state, sourceText) {
    return global.B20AiCore.request({
      action: 'generatePost',
      ...buildContext(state),
      signal: sourceText
    });
  }

  async function remix(state, sourceText, remixMode) {
    const unlocked = await global.B20AiCore.requirePremium(['aiLabAdvancedRemix', 'Advanced Remix']);

    if (!unlocked) {
      throw new Error('Lab Pass required for Advanced Remix.');
    }

    return global.B20AiCore.request({
      action: 'remixContent',
      ...buildContext(state),
      signal: sourceText,
      remixMode
    });
  }

  global.B20AiGenerator = {
    generate,
    generatePost,
    remix
  };
})(window);
