(function (global) {
  const maxItems = 30;
  const keys = {
    outputs: 'b20-ai-lab-outputs',
    posts: 'b20-ai-lab-posts',
    favorites: 'b20-ai-lab-favorites',
    memory: 'b20-ai-lab-project-memory',
    personas: 'b20-ai-lab-personas',
    language: 'b20-ai-lab-language',
    mode: 'b20-ai-lab-mode',
    agent: 'b20-ai-lab-agent',
    style: 'b20-ai-lab-style'
  };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(global.localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Local storage is optional; AI generation must continue without it.
    }
  }

  function readList(key) {
    const value = readJson(key, []);
    return Array.isArray(value) ? value : [];
  }

  function writeList(key, value) {
    writeJson(key, value.slice(0, maxItems));
  }

  function remember(key, entry) {
    const existing = readList(key).filter((item) => item.text !== entry.text);
    const next = [{ ...entry, savedAt: new Date().toISOString() }, ...existing];
    writeList(key, next);
    return next;
  }

  function readPreference(key, fallback) {
    try {
      return global.localStorage.getItem(key) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writePreference(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch (error) {
      // Preference storage is optional.
    }
  }

  function readMemory() {
    const memory = readJson(keys.memory, {});
    return memory && typeof memory === 'object' ? memory : {};
  }

  function saveMemory(memory) {
    writeJson(keys.memory, memory || {});
  }

  function readPersonas() {
    const custom = readList(keys.personas);
    const defaults = (global.B20AiFeatures && global.B20AiFeatures.defaultPersonas) || [];
    const seen = new Set();
    return [...defaults, ...custom].filter((persona) => {
      const id = persona.id || persona.name;
      if (!id || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  function savePersona(persona) {
    const custom = readList(keys.personas).filter((item) => item.id !== persona.id);
    writeList(keys.personas, [persona, ...custom]);
  }

  global.B20AiStorage = {
    keys,
    readList,
    writeList,
    remember,
    readPreference,
    writePreference,
    readMemory,
    saveMemory,
    readPersonas,
    savePersona
  };
})(window);
