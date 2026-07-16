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
    network: account.network || providerConfig.defaultNetwork || 'BASE',
    priority: Number(account.priority) || 0,
    partner: Boolean(account.partner),
    favorite: Boolean(account.favorite),
    hidden: Boolean(account.hidden),
    partnerName: account.partnerName || account.partnerLabel || '',
    description: account.description || '',
    website: account.website || '',
    logo: account.logo || '',
    minCreatedAt: account.minCreatedAt || '',
    minPostId: account.minPostId || '',
    scrapePaths: Array.isArray(account.scrapePaths)
      ? account.scrapePaths.map((value) => String(value || '').trim()).filter((value, index, values) => values.indexOf(value) === index)
      : []
  };
}

function normalizeCache(cache) {
  if (Array.isArray(cache)) {
    return {
      metadata: null,
      posts: cache
    };
  }

  if (cache && typeof cache === 'object') {
    return {
      metadata: cache.metadata || null,
      posts: Array.isArray(cache.posts) ? cache.posts : []
    };
  }

  return {
    metadata: null,
    posts: []
  };
}

function accountMap(accounts) {
  return new Map(accounts.map((account) => [String(account.username).toLowerCase(), account]));
}

function getStatusId(post) {
  const direct = String(post && post.id ? post.id : '').match(/(\d{12,})$/);

  if (direct) {
    return direct[1];
  }

  const url = String((post && (post.post_url || post.url)) || '');
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : '';
}

function compareSnowflakeIds(first, second) {
  try {
    const firstId = BigInt(first);
    const secondId = BigInt(second);
    return firstId === secondId ? 0 : firstId > secondId ? 1 : -1;
  } catch (error) {
    return 0;
  }
}

function getPostTime(post) {
  const time = new Date(post && post.created_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getMaxAgeCutoff(providerConfig) {
  const maxAgeDays = Number(providerConfig.maxPostAgeDays) || 30;
  return Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
}

function passesAccountStart(post, account) {
  const minPostId = String(account.minPostId || '');
  const statusId = getStatusId(post);

  if (minPostId && statusId) {
    return compareSnowflakeIds(statusId, minPostId) >= 0;
  }

  if (account.minCreatedAt) {
    const minTime = new Date(account.minCreatedAt).getTime();
    const postTime = getPostTime(post);

    if (Number.isFinite(minTime) && postTime && postTime < minTime) {
      return false;
    }
  }

  return true;
}

function passesFreshnessPolicy(post, account, providerConfig) {
  const postTime = getPostTime(post);

  if (!postTime) {
    return false;
  }

  if (postTime < getMaxAgeCutoff(providerConfig)) {
    return false;
  }

  return passesAccountStart(post, account);
}

function applyPostPolicy(posts, accounts, providerConfig) {
  const accountsByUsername = accountMap(accounts);

  return posts.filter((post) => {
    const account = accountsByUsername.get(String(post.username).toLowerCase()) || {};
    return passesFreshnessPolicy(post, account, providerConfig);
  });
}

function normalizePosts(posts, accounts, providerName, providerConfig) {
  const accountsByUsername = accountMap(accounts);

  return (Array.isArray(posts) ? posts : [])
    .map((post) => {
      const username = String(post && post.username ? post.username : '').toLowerCase();
      const account = accountsByUsername.get(username) || {};
      return normalizePost(post, account, post.source || providerName);
    })
    .filter((post) => post.username && post.text)
    .filter((post) => {
      const account = accountsByUsername.get(String(post.username).toLowerCase()) || {};
      return passesFreshnessPolicy(post, account, providerConfig);
    })
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

  return sortPosts(Array.from(postsById.values()))
    .slice(0, maxItems);
}

function mergeUniquePosts(currentPosts, nextPosts) {
  const postsById = new Map();

  [...currentPosts, ...nextPosts].forEach((post) => {
    if (post && post.id) {
      postsById.set(String(post.id), post);
    }
  });

  return sortPosts(Array.from(postsById.values()));
}

function getAccountsByUsernames(accounts, usernames) {
  const wantedUsernames = new Set(
    Array.from(usernames || [])
      .map((username) => String(username || '').toLowerCase())
      .filter(Boolean)
  );

  return accounts.filter((account) => wantedUsernames.has(String(account.username).toLowerCase()));
}

function isLaboratoryAccount(account) {
  return String(account && account.category || '').toLowerCase() === 'laboratory'
    || String(account && account.username || '').toLowerCase() === '0xb20lol';
}

function filterPostsForAccounts(posts, accounts) {
  const usernames = new Set(accounts.map((account) => String(account.username).toLowerCase()));

  return (Array.isArray(posts) ? posts : [])
    .filter((post) => usernames.has(String(post.username).toLowerCase()));
}

function annotateCoverage(providerName, diagnostics) {
  const coverage = diagnostics && Array.isArray(diagnostics.coverage)
    ? diagnostics.coverage
    : [];

  return coverage.map((entry) => ({
    provider: providerName,
    ...entry
  }));
}

function getPriorityWindowMs(post) {
  return post && post.category === 'laboratory' ? 15 * 60 * 1000 : 0;
}

function sortPosts(posts) {
  return posts.sort((first, second) => {
    const firstScore = getPostTime(first) + getPriorityWindowMs(first);
    const secondScore = getPostTime(second) + getPriorityWindowMs(second);

    if (secondScore !== firstScore) {
      return secondScore - firstScore;
    }

    return getPostTime(second) - getPostTime(first);
  });
}

function getLatestObservation(posts) {
  const latest = sortPosts([...posts])[0];
  return latest ? latest.created_at : null;
}

function sanitizeFailureMessage(message) {
  return String(message || 'Unknown provider failure.')
    .replace(/[A-Z]:\\[^\n]+/g, '[local-path]')
    .replace(/╔[\s\S]*?╝/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 320);
}

function sanitizeFailures(failures) {
  return (Array.isArray(failures) ? failures : []).map((failure) => ({
    provider: failure.provider || 'unknown',
    username: failure.username || undefined,
    message: sanitizeFailureMessage(failure.message)
  }));
}

function createMetadata({
  providerConfig,
  selected,
  accounts,
  posts,
  startedAt,
  durationMs,
  previousMetadata
}) {
  const laboratoryDiagnostics = selected.diagnostics && selected.diagnostics.laboratory
    ? selected.diagnostics.laboratory
    : previousMetadata && previousMetadata.laboratory
      ? previousMetadata.laboratory
      : null;

  return {
    version: 2,
    provider: selected.providerName,
    backendProvider: selected.providerName,
    providerOrder: getProviderOrder(providerConfig),
    generatedAt: new Date().toISOString(),
    durationMs,
    accounts: accounts.length,
    accountsScanned: accounts.length,
    posts: posts.length,
    postsCollected: selected.posts.length,
    latestObservationAt: getLatestObservation(posts),
    refreshIntervalMinutes: Number(providerConfig.refreshIntervalMinutes) || 10,
    networks: Array.from(new Set(accounts.map((account) => account.network))).sort(),
    categories: Array.from(new Set(accounts.map((account) => account.category))).sort(),
    failures: sanitizeFailures(selected.failures),
    coverage: selected.diagnostics && Array.isArray(selected.diagnostics.coverage)
      ? selected.diagnostics.coverage
      : [],
    laboratory: laboratoryDiagnostics,
    laboratoryProvider: laboratoryDiagnostics && laboratoryDiagnostics.provider
      ? laboratoryDiagnostics.provider
      : 'laboratory',
    apiStatus: laboratoryDiagnostics && laboratoryDiagnostics.apiStatus
      ? laboratoryDiagnostics.apiStatus
      : 'unknown',
    lastLaboratorySyncAt: laboratoryDiagnostics && laboratoryDiagnostics.lastSyncAt
      ? laboratoryDiagnostics.lastSyncAt
      : null,
    laboratoryImportedPosts: laboratoryDiagnostics && Number.isFinite(Number(laboratoryDiagnostics.importedPosts))
      ? Number(laboratoryDiagnostics.importedPosts)
      : 0,
    startedAt: startedAt.toISOString(),
    previousGeneratedAt: previousMetadata && previousMetadata.generatedAt ? previousMetadata.generatedAt : null
  };
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

async function runExternalProvider(providerName, accounts, providerConfig, previousPosts, previousMetadata) {
  const provider = getProvider(providerName);
  const fetchPosts = provider.fetchPosts || provider.getLatestPosts;

  if (typeof fetchPosts !== 'function') {
    throw new Error(`${providerName} does not expose fetchPosts().`);
  }

  const startedAt = Date.now();
  console.log(`[research] provider ${providerName}: start`);
  const result = await fetchPosts(accounts, {
    config: providerConfig,
    previousPosts,
    previousMetadata
  });
  const posts = normalizePosts(result && result.posts, accounts, providerName, providerConfig);
  const elapsed = Date.now() - startedAt;

  logProviderErrors(providerName, result && result.errors);
  console.log(`[research] provider ${providerName}: ${posts.length} posts in ${elapsed}ms`);

  return {
    providerName,
    posts,
    errors: (result && result.errors) || [],
    diagnostics: (result && result.diagnostics) || {}
  };
}

function mergeDiagnostics(selections) {
  const coverage = [];
  let laboratory = null;

  selections.forEach((selection) => {
    if (selection && selection.diagnostics && Array.isArray(selection.diagnostics.coverage)) {
      coverage.push(...selection.diagnostics.coverage);
    }

    if (selection && selection.diagnostics && selection.diagnostics.laboratory) {
      laboratory = selection.diagnostics.laboratory;
    }
  });

  return {
    coverage,
    laboratory
  };
}

function providerNameForSelections(selections) {
  const names = selections
    .map((selection) => selection && selection.providerName)
    .filter((name) => name && name !== 'none');

  return names.length ? names.join('+') : 'none';
}

async function selectPostsForAccounts(accounts, providerConfig, previousPosts, previousMetadata) {
  const providerOrder = getProviderOrder(providerConfig);
  const providerFailures = [];
  const collectedPosts = [];
  const coverage = [];
  const diagnostics = {};
  let selectedProviderName = '';
  let usernamesForFallback = new Set();

  console.log(`[research] provider order: ${providerOrder.join(' -> ')}`);

  for (const providerName of providerOrder) {
    if (providerName === 'cache') {
      if (collectedPosts.length) {
        break;
      }

      if (previousPosts.length) {
        console.log(`[research] provider cache: using ${previousPosts.length} preserved observations`);
        return {
          providerName: 'cache',
          posts: previousPosts,
          failures: providerFailures,
          diagnostics: {}
        };
      }

      console.log('[research] provider cache: skipped, cache is empty');
      continue;
    }

    try {
      const accountsToFetch = usernamesForFallback.size
        ? getAccountsByUsernames(accounts, usernamesForFallback)
        : accounts;

      if (!accountsToFetch.length) {
        break;
      }

      console.log(`[research] provider ${providerName}: scanning ${accountsToFetch.length}/${accounts.length} accounts`);
      const result = await runExternalProvider(providerName, accountsToFetch, providerConfig, previousPosts, previousMetadata);
      providerFailures.push(...result.errors);
      Object.assign(diagnostics, result.diagnostics || {});
      coverage.push(...annotateCoverage(providerName, result.diagnostics));
      usernamesForFallback = new Set(
        result.errors
          .map((error) => error && error.username)
          .filter(Boolean)
      );

      if (result.posts.length) {
        collectedPosts.splice(0, collectedPosts.length, ...mergeUniquePosts(collectedPosts, result.posts));
        selectedProviderName = selectedProviderName ? `${selectedProviderName}+${providerName}` : providerName;

        console.log(`[research] coverage after ${providerName}: ${accounts.length - usernamesForFallback.size}/${accounts.length} accounts without provider errors`);

        if (!usernamesForFallback.size) {
          break;
        }

        continue;
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

  if (collectedPosts.length) {
    return {
      providerName: selectedProviderName || 'mixed',
      posts: collectedPosts,
      failures: providerFailures,
      diagnostics: {
        ...diagnostics,
        coverage
      }
    };
  }

  return {
    providerName: 'none',
    posts: [],
    failures: providerFailures,
    diagnostics
  };
}

async function selectPosts(accounts, providerConfig, previousPosts, previousMetadata) {
  const providerOrder = getProviderOrder(providerConfig);

  if (!providerOrder.includes('laboratory')) {
    return selectPostsForAccounts(accounts, providerConfig, previousPosts, previousMetadata);
  }

  const laboratoryAccounts = accounts.filter(isLaboratoryAccount);
  const ecosystemAccounts = accounts.filter((account) => !isLaboratoryAccount(account));
  const selections = [];

  if (laboratoryAccounts.length) {
    const laboratoryConfig = {
      ...providerConfig,
      providerOrder: ['laboratory']
    };
    const laboratoryPreviousPosts = filterPostsForAccounts(previousPosts, laboratoryAccounts);
    const laboratorySelection = await selectPostsForAccounts(
      laboratoryAccounts,
      laboratoryConfig,
      laboratoryPreviousPosts,
      previousMetadata
    );

    selections.push(laboratorySelection);
  }

  if (ecosystemAccounts.length) {
    const ecosystemConfig = {
      ...providerConfig,
      providerOrder: providerOrder.filter((providerName) => providerName !== 'laboratory')
    };
    const ecosystemPreviousPosts = filterPostsForAccounts(previousPosts, ecosystemAccounts);
    const ecosystemSelection = await selectPostsForAccounts(
      ecosystemAccounts,
      ecosystemConfig,
      ecosystemPreviousPosts,
      previousMetadata
    );

    selections.push(ecosystemSelection);
  }

  return {
    providerName: providerNameForSelections(selections),
    posts: mergeUniquePosts([], selections.flatMap((selection) => selection.posts || [])),
    failures: selections.flatMap((selection) => selection.failures || []),
    diagnostics: mergeDiagnostics(selections)
  };
}

async function runOnce() {
  const [accountsConfig, providerConfig, previousCache] = await Promise.all([
    readJson(accountsPath, []),
    readJson(providerConfigPath, {}),
    readJson(cachePath, [])
  ]);

  const accounts = Array.isArray(accountsConfig)
    ? accountsConfig
      .map((account) => normalizeAccount(account, providerConfig))
      .filter((account) => account.username && !account.hidden)
    : [];
  const normalizedPreviousCache = normalizeCache(previousCache);
  const previousPosts = applyPostPolicy(normalizedPreviousCache.posts, accounts, providerConfig);
  const maxCacheItems = Number(providerConfig.maxCacheItems) || 400;
  const startedAt = new Date();

  console.log(`[research] observation started: ${startedAt.toISOString()}`);
  console.log(`[research] accounts: ${accounts.length}`);
  console.log(`[research] previous cache size: ${previousPosts.length}`);

  const selected = await selectPosts(accounts, providerConfig, previousPosts, normalizedPreviousCache.metadata);
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

  const durationMs = Date.now() - startedAt.getTime();
  const metadata = createMetadata({
    providerConfig,
    selected,
    accounts,
    posts: nextCache,
    startedAt,
    durationMs,
    previousMetadata: normalizedPreviousCache.metadata
  });
  const cachePayload = {
    metadata,
    posts: nextCache
  };

  await writeJson(cachePath, cachePayload);

  console.log(`[research] selected provider: ${selected.providerName}`);
  console.log(`[research] cache size: ${nextCache.length}`);
  console.log(`[research] duration: ${durationMs}ms`);

  if (selected.failures.length) {
    console.log('[research] fallback diagnostics:');
    selected.failures.forEach((failure) => {
      console.log(`- ${failure.provider}: ${failure.message}`);
    });
  }

  return cachePayload;
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
