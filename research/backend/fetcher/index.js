const fs = require('fs/promises');
const path = require('path');
const { getProvider, getProviderOrder } = require('../providers/provider');
const { normalizePost } = require('../providers/normalizer');

const backendRoot = path.resolve(__dirname, '..');
const accountsPath = path.join(backendRoot, 'config', 'accounts.json');
const providerConfigPath = path.join(backendRoot, 'config', 'provider.json');
const cachePath = path.join(backendRoot, 'cache', 'feed.json');

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    console.log(`[research] json read fallback: ${path.relative(backendRoot, filePath)}: ${error.message}`);
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function normalizeAccount(account, providerConfig) {
  return {
    ...account,
    username: String(account.username || '').replace(/^@/, ''),
    category: account.category || 'community',
    network: account.network || providerConfig.defaultNetwork || 'BASE'
  };
}

function accountMap(accounts) {
  return new Map(accounts.map((account) => [String(account.username).toLowerCase(), account]));
}

function normalizePosts(posts, accounts, providerName) {
  const accountsByUsername = accountMap(accounts);

  return (Array.isArray(posts) ? posts : [])
    .map((post) => {
      const username = String(post && post.username ? post.username : '').toLowerCase();
      const account = accountsByUsername.get(username) || {};
      return normalizePost(post, account, post.source || providerName);
    })
    .filter((post) => post.username && post.text)
    .filter((post, index, allPosts) => allPosts.findIndex((candidate) => candidate.id === post.id) === index);
}

function mergePosts(previousPosts, nextPosts, maxItems, options = {}) {
  const postsById = new Map();
  const previous = options.dropSamplePrevious
    ? previousPosts.filter((post) => post && post.source !== 'sample')
    : previousPosts;
  const previousById = new Map(previous.map((post) => [String(post.id), post]));

  for (const incomingPost of nextPosts) {
    if (!incomingPost || !incomingPost.id) {
      continue;
    }

    const previousPost = previousById.get(String(incomingPost.id));
    const post = previousPost
      ? {
        ...previousPost,
        ...incomingPost,
        created_at: previousPost.created_at,
        createdAt: previousPost.createdAt || previousPost.created_at
      }
      : incomingPost;

    postsById.set(String(post.id), post);
  }

  for (const post of previous) {
    if (!post || !post.id) {
      continue;
    }

    if (!postsById.has(String(post.id))) {
      postsById.set(String(post.id), post);
    }
  }

  return Array.from(postsById.values())
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
    .slice(0, maxItems);
}

function logProviderErrors(providerName, errors) {
  if (!Array.isArray(errors) || !errors.length) {
    return;
  }

  console.log(`[research] ${providerName} reported ${errors.length} account errors:`);
  errors.forEach((error) => {
    console.log(`- ${error.username || 'unknown'}: ${error.message || error}`);
  });
}

async function runExternalProvider(providerName, accounts, providerConfig, previousPosts) {
  const provider = getProvider(providerName);
  const fetchPosts = provider.fetchPosts || provider.getLatestPosts;

  if (typeof fetchPosts !== 'function') {
    throw new Error(`${providerName} does not expose fetchPosts().`);
  }

  const startedAt = Date.now();
  console.log(`[research] provider ${providerName}: start`);
  const result = await fetchPosts(accounts, {
    config: providerConfig,
    previousPosts
  });
  const posts = normalizePosts(result && result.posts, accounts, providerName);
  const elapsed = Date.now() - startedAt;

  logProviderErrors(providerName, result && result.errors);
  console.log(`[research] provider ${providerName}: ${posts.length} posts in ${elapsed}ms`);

  return {
    providerName,
    posts,
    errors: (result && result.errors) || []
  };
}

async function selectPosts(accounts, providerConfig, previousPosts) {
  const providerOrder = getProviderOrder(providerConfig);
  const providerFailures = [];

  console.log(`[research] provider order: ${providerOrder.join(' -> ')}`);

  for (const providerName of providerOrder) {
    if (providerName === 'cache') {
      if (previousPosts.length) {
        console.log(`[research] provider cache: using ${previousPosts.length} preserved observations`);
        return {
          providerName: 'cache',
          posts: previousPosts,
          failures: providerFailures
        };
      }

      console.log('[research] provider cache: skipped, cache is empty');
      continue;
    }

    try {
      const result = await runExternalProvider(providerName, accounts, providerConfig, previousPosts);

      if (result.posts.length) {
        return {
          providerName,
          posts: result.posts,
          failures: providerFailures
        };
      }

      providerFailures.push({
        provider: providerName,
        message: 'Provider returned zero posts.'
      });
      console.log(`[research] provider ${providerName}: returned zero posts, continuing fallback chain`);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      providerFailures.push({
        provider: providerName,
        message
      });
      console.log(`[research] provider ${providerName}: failed: ${message}`);
    }
  }

  return {
    providerName: 'none',
    posts: [],
    failures: providerFailures
  };
}

async function runOnce() {
  const [accountsConfig, providerConfig, previousCache] = await Promise.all([
    readJson(accountsPath, []),
    readJson(providerConfigPath, {}),
    readJson(cachePath, [])
  ]);

  const accounts = Array.isArray(accountsConfig)
    ? accountsConfig.map((account) => normalizeAccount(account, providerConfig)).filter((account) => account.username)
    : [];
  const previousPosts = Array.isArray(previousCache) ? previousCache : [];
  const maxCacheItems = Number(providerConfig.maxCacheItems) || 400;
  const startedAt = new Date();

  console.log(`[research] observation started: ${startedAt.toISOString()}`);
  console.log(`[research] accounts: ${accounts.length}`);
  console.log(`[research] previous cache size: ${previousPosts.length}`);

  const selected = await selectPosts(accounts, providerConfig, previousPosts);
  const isRealProvider = !['cache', 'sample', 'none'].includes(selected.providerName);
  const shouldDropSamplePrevious = isRealProvider;
  const nextCache = selected.providerName === 'cache'
    ? previousPosts.slice(0, maxCacheItems)
    : mergePosts(previousPosts, selected.posts, maxCacheItems, {
      dropSamplePrevious: shouldDropSamplePrevious
    });

  if (!nextCache.length) {
    throw new Error('Research feed generation failed and no fallback produced posts.');
  }

  await writeJson(cachePath, nextCache);

  console.log(`[research] selected provider: ${selected.providerName}`);
  console.log(`[research] cache size: ${nextCache.length}`);

  if (selected.failures.length) {
    console.log('[research] fallback diagnostics:');
    selected.failures.forEach((failure) => {
      console.log(`- ${failure.provider}: ${failure.message}`);
    });
  }

  return nextCache;
}

async function run() {
  const providerConfig = await readJson(providerConfigPath, {});

  if (!process.argv.includes('--watch')) {
    await runOnce();
    return;
  }

  const intervalMinutes = Number(providerConfig.refreshIntervalMinutes) || 10;
  const intervalMs = intervalMinutes * 60 * 1000;

  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error(`[research] fetch failed: ${error.message}`);
    }

    await sleep(intervalMs);
  }
}

run().catch((error) => {
  console.error(`[research] fatal: ${error.message}`);
  process.exitCode = 1;
});
