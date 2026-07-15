const fs = require('fs/promises');
const path = require('path');
const { createProvider } = require('../providers/provider');

const backendRoot = path.resolve(__dirname, '..');
const accountsPath = path.join(backendRoot, 'config', 'accounts.json');
const providerConfigPath = path.join(backendRoot, 'config', 'provider.json');
const cachePath = path.join(backendRoot, 'cache', 'feed.json');

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
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
    category: account.category || 'community',
    network: account.network || providerConfig.defaultNetwork || 'BASE'
  };
}

function mergePosts(previousPosts, nextPosts, maxItems) {
  const postsById = new Map();

  for (const post of [...nextPosts, ...previousPosts]) {
    if (!post || !post.id) {
      continue;
    }

    postsById.set(String(post.id), post);
  }

  return Array.from(postsById.values())
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
    .slice(0, maxItems);
}

async function runOnce() {
  const [accountsConfig, providerConfig, previousCache] = await Promise.all([
    readJson(accountsPath, []),
    readJson(providerConfigPath, {}),
    readJson(cachePath, [])
  ]);

  const accounts = Array.isArray(accountsConfig)
    ? accountsConfig.map((account) => normalizeAccount(account, providerConfig))
    : [];
  const provider = createProvider(providerConfig);
  const previousPosts = Array.isArray(previousCache) ? previousCache : [];
  const maxCacheItems = Number(providerConfig.maxCacheItems) || 400;
  const startedAt = new Date();

  console.log(`[research] observation started: ${startedAt.toISOString()}`);
  console.log(`[research] accounts: ${accounts.length}`);

  const result = await provider.getLatestPosts({
    accounts,
    config: providerConfig
  });

  const mergedPosts = mergePosts(previousPosts, result.posts || [], maxCacheItems);
  await writeJson(cachePath, mergedPosts);

  console.log(`[research] new observations: ${(result.posts || []).length}`);
  console.log(`[research] cache size: ${mergedPosts.length}`);

  if (result.errors && result.errors.length) {
    console.log('[research] provider errors:');
    result.errors.forEach((error) => {
      console.log(`- ${error.username}: ${error.message}`);
    });
  }

  return mergedPosts;
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
