(function (global) {
  const endpoint = '/api/ai/generate';

  function errorMessage(error, fallback) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  function timeoutSignal(timeoutMs, externalSignal) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs || 22000);

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    return { signal: controller.signal, clear: () => window.clearTimeout(timer) };
  }

  async function request(payload, options = {}) {
    const requestSignal = timeoutSignal(options.timeoutMs || 24000, options.signal);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: requestSignal.signal,
      body: JSON.stringify(payload)
    }).finally(requestSignal.clear);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'AI engine unavailable.');
    }

    return data;
  }

  async function requestWithRetry(payload, options = {}) {
    const attempts = Math.max(1, Math.min(3, Number(options.attempts || 2)));
    let lastError = null;

    for (let index = 0; index < attempts; index += 1) {
      try {
        return await request(payload, options);
      } catch (error) {
        lastError = error;

        if (options.signal?.aborted || (error instanceof Error && /Lab Pass|required/i.test(error.message))) {
          throw error;
        }

        if (index < attempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 450 + index * 350));
        }
      }
    }

    throw lastError || new Error('AI engine unavailable.');
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
    requestWithRetry,
    initPremium,
    requirePremium,
    errorMessage
  };
})(window);
