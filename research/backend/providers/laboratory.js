const { normalizePost } = require('./normalizer');
const xapi = require('./xapi');

function isLaboratoryAccount(account) {
  return String(account && account.category || '').toLowerCase() === 'laboratory'
    || String(account && account.username || '').toLowerCase() === '0xb20lol';
}

function getPostTime(post) {
  const time = new Date(post && (post.created_at || post.createdAt)).getTime();
  return Number.isFinite(time) ? time : 0;
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

function newestStatusId(posts) {
  return posts
    .map((post) => getStatusId(post))
    .filter(Boolean)
    .sort(compareSnowflakeIds)
    .pop() || '';
}

function previousForLaboratory(previousPosts, accounts) {
  const usernames = new Set(accounts.map((account) => String(account.username).toLowerCase()));

  return (Array.isArray(previousPosts) ? previousPosts : [])
    .filter((post) => usernames.has(String(post.username).toLowerCase()))
    .sort((first, second) => getPostTime(second) - getPostTime(first));
}

function mergeLaboratoryPosts(previousPosts, nextPosts) {
  const postsById = new Map();

  [...previousPosts, ...nextPosts].forEach((post) => {
    if (post && post.id) {
      postsById.set(String(post.id), post);
    }
  });

  return Array.from(postsById.values())
    .sort((first, second) => getPostTime(second) - getPostTime(first));
}

function refreshIntervalMinutes(config) {
  return Number(config.laboratory && config.laboratory.refreshIntervalMinutes) || 720;
}

function nextSyncAt(lastSyncAt, config) {
  const lastSyncTime = new Date(lastSyncAt || 0).getTime();

  if (!Number.isFinite(lastSyncTime) || !lastSyncTime) {
    return null;
  }

  return new Date(lastSyncTime + refreshIntervalMinutes(config) * 60 * 1000).toISOString();
}

function shouldSync(previousMetadata, config) {
  const laboratory = previousMetadata && previousMetadata.laboratory;
  const lastSyncTime = new Date(laboratory && laboratory.lastSyncAt).getTime();

  if (!Number.isFinite(lastSyncTime) || !lastSyncTime) {
    return true;
  }

  return Date.now() - lastSyncTime >= refreshIntervalMinutes(config) * 60 * 1000;
}

function createDiagnostics(status, details = {}) {
  return {
    laboratory: {
      provider: 'xapi',
      apiStatus: status,
      status,
      refreshIntervalMinutes: details.refreshIntervalMinutes,
      lastSyncAt: details.lastSyncAt || null,
      nextSyncAt: details.nextSyncAt || null,
      importedPosts: details.importedPosts || 0,
      accountsScanned: details.accountsScanned || 0,
      skipped: Boolean(details.skipped),
      error: details.error || ''
    }
  };
}

async function fetchPosts(accounts, context = {}) {
  const config = context.config || {};
  const previousMetadata = context.previousMetadata || {};
  const laboratoryAccounts = (Array.isArray(accounts) ? accounts : []).filter(isLaboratoryAccount);
  const previousPosts = previousForLaboratory(context.previousPosts || [], laboratoryAccounts);
  const intervalMinutes = refreshIntervalMinutes(config);

  if (!laboratoryAccounts.length) {
    return {
      posts: [],
      errors: [],
      diagnostics: createDiagnostics('not_configured', {
        refreshIntervalMinutes: intervalMinutes
      })
    };
  }

  if (!shouldSync(previousMetadata, config)) {
    const lastSyncAt = previousMetadata.laboratory && previousMetadata.laboratory.lastSyncAt;

    return {
      posts: previousPosts,
      errors: [],
      diagnostics: createDiagnostics('skipped', {
        refreshIntervalMinutes: intervalMinutes,
        lastSyncAt,
        nextSyncAt: nextSyncAt(lastSyncAt, config),
        accountsScanned: laboratoryAccounts.length,
        skipped: true
      })
    };
  }

  const posts = [];
  const errors = [];
  let importedPosts = 0;

  for (const account of laboratoryAccounts) {
    try {
      const accountPreviousPosts = previousForLaboratory(previousPosts, [account]);
      const sinceId = accountPreviousPosts.length ? newestStatusId(accountPreviousPosts) : '';
      const result = await xapi.fetchAccountPosts(account, {
        config,
        previousPosts: accountPreviousPosts,
        sinceId
      });
      const normalizedPosts = (result.posts || []).map((post) => normalizePost(post, account, 'xapi'));

      importedPosts += normalizedPosts.length;
      posts.push(...mergeLaboratoryPosts(accountPreviousPosts, normalizedPosts));
    } catch (error) {
      errors.push({
        provider: 'laboratory',
        username: account.username,
        message: error && error.message ? error.message : String(error)
      });
    }
  }

  if (errors.length) {
    return {
      posts: previousPosts,
      errors,
      diagnostics: createDiagnostics('failed', {
        refreshIntervalMinutes: intervalMinutes,
        lastSyncAt: previousMetadata.laboratory && previousMetadata.laboratory.lastSyncAt,
        nextSyncAt: previousMetadata.laboratory && previousMetadata.laboratory.nextSyncAt,
        importedPosts: 0,
        accountsScanned: laboratoryAccounts.length,
        error: errors.map((error) => error.message).join('; ')
      })
    };
  }

  const now = new Date().toISOString();

  return {
    posts,
    errors: [],
    diagnostics: createDiagnostics('online', {
      refreshIntervalMinutes: intervalMinutes,
      lastSyncAt: now,
      nextSyncAt: nextSyncAt(now, config),
      importedPosts,
      accountsScanned: laboratoryAccounts.length
    })
  };
}

module.exports = {
  fetchPosts,
  getLatestPosts: fetchPosts,
  isLaboratoryAccount
};
