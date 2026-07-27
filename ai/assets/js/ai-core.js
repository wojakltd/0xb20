(function (global) {
  const endpoint = '/api/ai/generate';

  function errorMessage(error, fallback) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  async function request(payload) {
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

  async function initPremium() {
    if (!global.B20Premium) {
      return null;
    }

    return global.B20Premium.init();
  }

  async function requirePremium(feature) {
    if (!feature || !global.B20Premium) {
      return true;
    }

    const [featureId, featureLabel] = feature;
    return global.B20Premium.requireAccess(featureId, featureLabel);
  }

  global.B20AiCore = {
    request,
    initPremium,
    requirePremium,
    errorMessage
  };
})(window);
