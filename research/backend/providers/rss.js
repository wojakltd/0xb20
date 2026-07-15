const { parseFeed } = require('./parser');

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function buildUrls(account, config) {
  if (account.feedUrl) {
    return [account.feedUrl];
  }

  const templates = (config.rss && config.rss.bridgeTemplates) || [];
  return templates.map((template) => template.replace('{username}', encodeURIComponent(account.username)));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
        'user-agent': '0XB20-Laboratory-Research/1.0'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAccountFeed(account, config) {
  const urls = buildUrls(account, config);
  const timeoutMs = (config.rss && config.rss.timeoutMs) || 15000;
  const retries = (config.rss && config.rss.retries) || 1;
  let lastError;

  for (const url of urls) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const xml = await fetchWithTimeout(url, timeoutMs);
        return parseFeed(xml, account);
      } catch (error) {
        lastError = error;
        await sleep(400 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error(`No RSS bridge URL configured for ${account.username}`);
}

async function getLatestPosts({ accounts, config }) {
  const requestDelayMs = Number(config.requestDelayMs) || 1000;
  const maxPostsPerAccount = Number(config.maxPostsPerAccount) || 8;
  const posts = [];
  const errors = [];

  for (const account of accounts) {
    try {
      const accountPosts = await fetchAccountFeed(account, config);
      posts.push(...accountPosts.slice(0, maxPostsPerAccount));
    } catch (error) {
      errors.push({
        username: account.username,
        message: error.message
      });
    }

    await sleep(requestDelayMs);
  }

  return {
    posts,
    errors
  };
}

module.exports = {
  getLatestPosts
};
