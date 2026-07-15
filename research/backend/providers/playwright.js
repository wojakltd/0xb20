const { normalizePost, toNumber, unique } = require('./normalizer');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error('Playwright dependency is not installed. Run npm install inside research/backend.');
  }
}

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function getConfig(config) {
  return {
    headless: config.playwright && config.playwright.headless !== false,
    navigationTimeoutMs: Number(config.playwright && config.playwright.navigationTimeoutMs) || 25000,
    selectorTimeoutMs: Number(config.playwright && config.playwright.selectorTimeoutMs) || 12000,
    maxPostsPerAccount: Number(config.maxPostsPerAccount) || 10,
    requestDelayMs: Number(config.requestDelayMs) || 1200,
    scrollPasses: Number(config.playwright && config.playwright.scrollPasses) || 5,
    failureLimitBeforeFallback: Number(config.playwright && config.playwright.failureLimitBeforeFallback) || 3
  };
}

async function preparePage(context) {
  const page = await context.newPage();

  await page.route('**/*', async (route) => {
    const type = route.request().resourceType();

    if (['font', 'media'].includes(type)) {
      await route.abort();
      return;
    }

    await route.continue();
  });

  return page;
}

async function extractPosts(page, account, maxPostsPerAccount) {
  return page.evaluate(({ username, accountData, maxPosts }) => {
    const profileUsername = String(username || '').toLowerCase();
    const toAbsoluteUrl = (href) => new URL(href, 'https://x.com').href.replace('https://twitter.com/', 'https://x.com/');
    const uniqueValues = (values) => Array.from(new Set(values.filter(Boolean)));
    const parseMetric = (value) => {
      const match = String(value || '').replace(/,/g, '').match(/([\d.]+)\s*([KkMm])?/);

      if (!match) {
        return 0;
      }

      const amount = Number(match[1]);
      const multiplier = /m/i.test(match[2] || '') ? 1000000 : /k/i.test(match[2] || '') ? 1000 : 1;
      return Number.isFinite(amount) ? Math.round(amount * multiplier) : 0;
    };
    const getMetric = (article, testId) => {
      const target = article.querySelector(`[data-testid="${testId}"]`);
      const label = target && target.getAttribute('aria-label');
      const text = target && target.textContent;
      return parseMetric(label || text);
    };

    return Array.from(document.querySelectorAll('article'))
      .map((article) => {
        const statusLink = Array.from(article.querySelectorAll('a[href*="/status/"]'))
          .map((anchor) => anchor.getAttribute('href') || '')
          .find((href) => {
            const normalized = href.toLowerCase();
            return normalized.includes(`/${profileUsername}/status/`) || normalized.includes(`x.com/${profileUsername}/status/`) || normalized.includes(`twitter.com/${profileUsername}/status/`);
          });

        if (!statusLink) {
          return null;
        }

        const url = toAbsoluteUrl(statusLink);
        const statusMatch = url.match(/\/status\/(\d+)/);
        const id = statusMatch ? `${profileUsername}-${statusMatch[1]}` : url;
        const text = Array.from(article.querySelectorAll('[data-testid="tweetText"]'))
          .map((node) => node.innerText.trim())
          .filter(Boolean)
          .join('\n\n');
        const time = article.querySelector('time');
        const createdAt = time ? time.getAttribute('datetime') : new Date().toISOString();
        const nameText = article.querySelector('[data-testid="User-Name"]');
        const displayName = nameText ? nameText.innerText.split('\n').find(Boolean) : accountData.displayName || accountData.username;
        const imageSources = Array.from(article.querySelectorAll('img')).map((image) => image.src);
        const avatar = imageSources.find((source) => source.includes('profile_images')) || accountData.avatar || '';
        const images = uniqueValues(imageSources.filter((source) => source.includes('pbs.twimg.com/media') || source.includes('pbs.twimg.com/amplify_video_thumb')));

        if (!text && !images.length) {
          return null;
        }

        return {
          id,
          displayName,
          username: accountData.username,
          avatar,
          text,
          createdAt,
          url,
          images,
          replies: getMetric(article, 'reply'),
          reposts: getMetric(article, 'retweet'),
          likes: getMetric(article, 'like')
        };
      })
      .filter(Boolean)
      .filter((post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index)
      .slice(0, maxPosts);
  }, {
    username: account.username,
    accountData: account,
    maxPosts: maxPostsPerAccount
  });
}

async function scrapeAccount(context, account, providerConfig) {
  const page = await preparePage(context);
  const url = `https://x.com/${encodeURIComponent(account.username)}`;

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: providerConfig.navigationTimeoutMs
    });

    await page.waitForSelector('article, [data-testid="primaryColumn"], [data-testid="emptyState"]', {
      timeout: providerConfig.selectorTimeoutMs
    });

    let posts = [];

    for (let pass = 0; pass <= providerConfig.scrollPasses; pass += 1) {
      posts = await extractPosts(page, account, providerConfig.maxPostsPerAccount);

      if (posts.length >= providerConfig.maxPostsPerAccount) {
        break;
      }

      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(800);
    }

    if (!posts.length) {
      throw new Error('No public timeline posts found. X may be blocking anonymous browser access.');
    }

    return posts.map((post) => normalizePost(post, account, 'playwright'));
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchPosts(accounts, context = {}) {
  const config = context.config || {};
  const providerConfig = getConfig(config);
  const { chromium } = loadPlaywright();
  const posts = [];
  const errors = [];
  let failedAccountsBeforeSuccess = 0;
  const browser = await chromium.launch({
    headless: providerConfig.headless,
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  });

  try {
    const browserContext = await browser.newContext({
      locale: 'en-US',
      timezoneId: 'UTC',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 }
    });

    for (const account of accounts) {
      try {
        const accountPosts = await scrapeAccount(browserContext, account, providerConfig);
        posts.push(...accountPosts);
        console.log(`[research:playwright] ${account.username}: ${accountPosts.length} posts`);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        console.log(`[research:playwright] ${account.username}: ${message}`);
        errors.push({
          provider: 'playwright',
          username: account.username,
          message
        });

        if (!posts.length) {
          failedAccountsBeforeSuccess += 1;
        }

        if (!posts.length && failedAccountsBeforeSuccess >= providerConfig.failureLimitBeforeFallback) {
          console.log(`[research:playwright] fail-fast: ${failedAccountsBeforeSuccess} accounts failed before any post was captured`);
          break;
        }
      }

      await sleep(providerConfig.requestDelayMs);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return { posts, errors };
}

module.exports = {
  fetchPosts,
  getLatestPosts: fetchPosts
};
