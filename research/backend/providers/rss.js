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
  const timeoutMs = Number(config.rss && config.rss.timeoutMs) || 15000;
  const retries = Number.isFinite(Number(config.rss && config.rss.retries))
    ? Number(config.rss.retries)
    : 1;
  const failures = [];

  for (const url of urls) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const xml = await fetchWithTimeout(url, timeoutMs);
        const posts = parseFeed(xml, account);

        if (!posts.length) {
          throw new Error('RSS document contained no parseable items.');
        }

        return posts;
      } catch (error) {
        const message = `${url} attempt ${attempt + 1}/${retries + 1}: ${error.message}`;
        failures.push(message);
        console.log(`[research:rss] ${account.username}: ${message}`);
        await sleep(400 * (attempt + 1));
      }
    }
  }

  throw new Error(failures.length ? failures.join(' | ') : `No RSS bridge URL configured for ${account.username}`);
}

async function fetchPosts(accounts, context = {}) {
  const config = context.config || {};
  const requestDelayMs = Number(config.requestDelayMs) || 1000;
  const maxPostsPerAccount = Number(config.maxPostsPerAccount) || 8;
  const posts = [];
  const errors = [];
  const coverage = [];

  for (const account of accounts) {
    try {
      const accountPosts = await fetchAccountFeed(account, config);
      const returnedPosts = accountPosts.slice(0, maxPostsPerAccount);
      posts.push(...returnedPosts);
      coverage.push({
        username: account.username,
        parsed: accountPosts.length,
        returned: returnedPosts.length
      });
      console.log(`[research:rss] ${account.username}: ${accountPosts.length} posts`);
    } catch (error) {
      errors.push({
        provider: 'rss',
        username: account.username,
        message: error.message
      });
      coverage.push({
        username: account.username,
        parsed: 0,
        returned: 0,
        error: error.message
      });
    }

    await sleep(requestDelayMs);
  }

  return {
    posts,
    errors,
    diagnostics: {
      coverage
    }
  };
}

module.exports = {
  fetchPosts,
  getLatestPosts: fetchPosts
};
