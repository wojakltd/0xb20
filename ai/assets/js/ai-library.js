(function (global) {
  function categories() {
    return Object.keys(global.B20AiFeatures.promptLibrary || {});
  }

  function prompts(category) {
    const library = global.B20AiFeatures.promptLibrary || {};
    return Array.isArray(library[category]) ? library[category] : [];
  }

  function addFavoritePrompt(prompt) {
    const library = global.B20AiFeatures.promptLibrary;
    if (!library || !prompt) {
      return;
    }

    library.Favorites = [prompt, ...(library.Favorites || []).filter((item) => item !== prompt)].slice(0, 12);
  }

  global.B20AiLibrary = {
    categories,
    prompts,
    addFavoritePrompt
  };
})(window);
