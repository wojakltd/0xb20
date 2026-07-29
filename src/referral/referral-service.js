const defaultConfig = {
  programName: '0XB20 Laboratory Partner Program',
  currency: 'USDC',
  minimumWithdraw: 20,
  levels: [
    { level: 1, percent: 35 },
    { level: 2, percent: 10 },
    { level: 3, percent: 5 }
  ],
  ranks: [
    { name: 'Explorer', minReferrals: 0 },
    { name: 'Researcher', minReferrals: 10 },
    { name: 'Operator', minReferrals: 50 },
    { name: 'Architect', minReferrals: 150 }
  ],
  toolsTotal: 8,
  toolsUnlockedWithLabPass: 3,
  labPassReferenceUsd: 10
};

const postgresStore = require('./postgres-store');

const memory = {
  users: new Map(),
  rewards: new Map(),
  purchases: new Map(),
  earnings: new Map(),
  withdrawals: new Map(),
  referralChildren: new Map(),
  sync: new Map()
};

function nowIso() {
  return new Date().toISOString();
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function normalizeAddress(value) {
  const address = String(value || '').trim();

  if (!isAddress(address)) {
    throw new Error('Invalid wallet address.');
  }

  return address.toLowerCase();
}

function sameAddress(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '--';
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function redisEnv() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
  };
}

function hasRedis() {
  const env = redisEnv();
  return Boolean(env.url && env.token && typeof fetch === 'function');
}

function storageInfo() {
  if (postgresStore.isEnabled()) {
    return postgresStore.providerInfo();
  }

  if (hasRedis()) {
    return {
      provider: 'Vercel KV / Upstash Redis',
      persistent: true
    };
  }

  return {
    provider: 'Volatile serverless memory',
    persistent: false
  };
}

async function redisCommand(command) {
  const env = redisEnv();
  const response = await fetch(env.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    throw new Error('Referral database unavailable.');
  }

  const payload = await response.json();

  if (payload && payload.error) {
    throw new Error('Referral database rejected request.');
  }

  return payload ? payload.result : null;
}

async function getJson(key, fallback) {
  if (postgresStore.isEnabled()) {
    return postgresStore.getJson(key, fallback);
  }

  if (hasRedis()) {
    const raw = await redisCommand(['GET', key]);
    return raw ? JSON.parse(raw) : fallback;
  }

  const [collection, id] = key.split(':').slice(-2);
  const store = memory[collection];

  if (store instanceof Map) {
    return store.get(id) || fallback;
  }

  return fallback;
}

async function setJson(key, value) {
  if (postgresStore.isEnabled()) {
    return postgresStore.setJson(key, value);
  }

  if (hasRedis()) {
    await redisCommand(['SET', key, JSON.stringify(value)]);
    return value;
  }

  const [collection, id] = key.split(':').slice(-2);
  const store = memory[collection];

  if (store instanceof Map) {
    store.set(id, value);
  }

  return value;
}

function key(collection, wallet) {
  return `b20:referral:${collection}:${wallet}`;
}

function defaultUser(wallet) {
  return {
    wallet,
    joinedAt: nowIso(),
    referrer: '',
    labPassExpiration: 0,
    status: 'registered'
  };
}

function defaultRewards(wallet) {
  return {
    wallet,
    earned: 0,
    available: 0,
    pending: 0,
    withdrawn: 0,
    lastWithdrawal: ''
  };
}

async function getUser(wallet) {
  return getJson(key('users', wallet), null);
}

async function saveUser(user) {
  return setJson(key('users', user.wallet), user);
}

async function ensureUser(wallet) {
  const normalized = normalizeAddress(wallet);
  const existing = await getUser(normalized);

  if (existing) {
    return existing;
  }

  return saveUser(defaultUser(normalized));
}

async function getRewards(wallet) {
  return getJson(key('rewards', wallet), defaultRewards(wallet));
}

async function saveRewards(rewards) {
  return setJson(key('rewards', rewards.wallet), rewards);
}

async function getArray(collection, wallet) {
  return getJson(key(collection, wallet), []);
}

async function setArray(collection, wallet, value) {
  return setJson(key(collection, wallet), value);
}

async function getSyncState(name) {
  return getJson(key('sync', String(name || 'default')), {});
}

async function setSyncState(name, value) {
  return setJson(key('sync', String(name || 'default')), value);
}

async function referrerChain(wallet, maxDepth = 3) {
  const chain = [];
  let cursor = normalizeAddress(wallet);

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const user = await getUser(cursor);

    if (!user || !user.referrer) {
      break;
    }

    const referrer = normalizeAddress(user.referrer);
    chain.push(referrer);
    cursor = referrer;
  }

  return chain;
}

async function wouldCreateLoop(wallet, referrer) {
  if (sameAddress(wallet, referrer)) {
    return true;
  }

  const chain = await referrerChain(referrer, 12);
  return chain.some((ancestor) => sameAddress(ancestor, wallet));
}

async function bindReferral(wallet, referrer) {
  const normalizedWallet = normalizeAddress(wallet);
  const normalizedReferrer = referrer && isAddress(referrer) ? normalizeAddress(referrer) : '';
  const user = await ensureUser(normalizedWallet);

  if (!normalizedReferrer || user.referrer) {
    return user;
  }

  await ensureUser(normalizedReferrer);

  if (await wouldCreateLoop(normalizedWallet, normalizedReferrer)) {
    return user;
  }

  user.referrer = normalizedReferrer;
  user.referrerBoundAt = nowIso();
  await saveUser(user);

  const children = await getArray('referralChildren', normalizedReferrer);

  if (!children.some((child) => sameAddress(child, normalizedWallet))) {
    children.push(normalizedWallet);
    await setArray('referralChildren', normalizedReferrer, children);
  }

  return user;
}

function rankFromReferrals(totalReferrals) {
  return [...defaultConfig.ranks]
    .reverse()
    .find((rank) => totalReferrals >= rank.minReferrals)?.name || defaultConfig.ranks[0].name;
}

function referralLink(wallet, origin) {
  const base = origin && /^https?:\/\//i.test(origin) ? origin.replace(/\/$/, '') : 'https://0xb20.lol';
  return `${base}/?ref=${wallet}`;
}

function buildMaterials(wallet, origin) {
  const link = referralLink(wallet, origin);

  return {
    invitation: `Join the 0XB20 Laboratory.\n\nOne Lab Pass unlocks the growing Web3 research toolkit.\n\n${link}`,
    xPost: `The 0XB20 Laboratory is turning Web3 tools into a living research terminal.\n\nWallet Parser. Token Sender. AI LAB.\n\nLab Pass unlocks the advanced layer.\n\n${link}`,
    thread: [
      '0XB20 is not another static token website.',
      'It is becoming a public Web3 Laboratory with tools, research and experiments shipped in public.',
      `Enter the Laboratory:\n${link}`
    ],
    featureList: [
      'Wallet Parser',
      'Token Sender',
      'AI LAB',
      'Research Terminal',
      'Profile / Partner Dashboard'
    ],
    labPass: 'Lab Pass is one membership for the entire 0XB20 Laboratory ecosystem.',
    referralExplanation: 'Share one referral link. The partner account tracks ecosystem-level rewards, not per-tool rewards.'
  };
}

function commissionPlan() {
  return defaultConfig.levels.map((level) => ({
    level: level.level,
    percent: safeNumber(level.percent)
  }));
}

function calculateRewards(amount, chain) {
  const numericAmount = safeNumber(amount);
  const plan = commissionPlan();

  return chain.slice(0, plan.length).map((entry, index) => {
    const rule = plan[index];
    const wallet = normalizeAddress(entry && entry.wallet ? entry.wallet : entry);
    const rewardAmount = Number(((numericAmount * rule.percent) / 100).toFixed(6));

    return {
      wallet,
      level: rule.level,
      percent: rule.percent,
      amount: rewardAmount
    };
  }).filter((reward) => reward.amount > 0);
}

async function recordPurchase(body) {
  const wallet = normalizeAddress(body.wallet);
  const amount = safeNumber(body.amount);
  const txHash = String(body.txHash || '').trim();
  const currency = String(body.currency || defaultConfig.currency).trim().toUpperCase();
  const timestamp = body.timestamp || nowIso();

  if (amount <= 0) {
    throw new Error('Purchase amount required.');
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error('Valid purchase transaction hash required.');
  }

  const user = await ensureUser(wallet);

  if (body.labPassExpiration) {
    user.labPassExpiration = safeNumber(body.labPassExpiration);
    await saveUser(user);
  }

  const purchases = await getArray('purchases', wallet);
  const duplicate = purchases.some((purchase) => String(purchase.txHash).toLowerCase() === txHash.toLowerCase());

  if (duplicate) {
    return {
      duplicate: true,
      rewards: [],
      purchase: purchases.find((purchase) => String(purchase.txHash).toLowerCase() === txHash.toLowerCase())
    };
  }

  const purchase = {
    wallet,
    amount,
    currency,
    txHash,
    timestamp,
    status: 'verified',
    source: body.source || 'manual',
    eventName: body.eventName || '',
    blockNumber: body.blockNumber ? safeNumber(body.blockNumber) : 0,
    paymentToken: body.paymentToken || '',
    paymentRaw: body.paymentRaw ? String(body.paymentRaw) : '',
    labPassExpiration: body.labPassExpiration ? safeNumber(body.labPassExpiration) : 0
  };
  purchases.push(purchase);
  await setArray('purchases', wallet, purchases);

  const chain = await referrerChain(wallet, defaultConfig.levels.length);
  const rewards = calculateRewards(amount, chain);

  for (const reward of rewards) {
    const balance = await getRewards(reward.wallet);
    balance.earned = Number((safeNumber(balance.earned) + reward.amount).toFixed(6));
    balance.available = Number((safeNumber(balance.available) + reward.amount).toFixed(6));
    await saveRewards(balance);

    const earnings = await getArray('earnings', reward.wallet);
    earnings.push({
      wallet: reward.wallet,
      sourceWallet: wallet,
      purchaseTxHash: txHash,
      amount: reward.amount,
      currency,
      level: reward.level,
      commission: reward.percent,
      status: 'available',
      timestamp
    });
    await setArray('earnings', reward.wallet, earnings);
  }

  return {
    duplicate: false,
    purchase,
    rewards
  };
}

async function buildStats(wallet) {
  const children = await getArray('referralChildren', wallet);
  const rewards = await getRewards(wallet);
  const earnings = await getArray('earnings', wallet);
  const withdrawals = await getArray('withdrawals', wallet);

  const level2 = (await Promise.all(children.map((child) => getArray('referralChildren', child))))
    .flat();
  const level3 = (await Promise.all(level2.map((child) => getArray('referralChildren', child))))
    .flat();

  const activeReferrals = earnings
    .map((entry) => entry.wallet)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .length;

  const totalReferrals = children.length + level2.length + level3.length;

  return {
    totalReferrals,
    activeReferrals,
    inactiveReferrals: Math.max(0, totalReferrals - activeReferrals),
    levels: {
      level1: children.length,
      level2: level2.length,
      level3: level3.length
    },
    conversionRate: totalReferrals ? Number(((activeReferrals / totalReferrals) * 100).toFixed(2)) : 0,
    lifetimeRevenue: Number(rewards.earned.toFixed(2)),
    pending: Number(rewards.pending.toFixed(2)),
    available: Number(rewards.available.toFixed(2)),
    withdrawn: Number(rewards.withdrawn.toFixed(2)),
    withdrawals
  };
}

async function dashboard(wallet, referrer, origin) {
  const normalizedWallet = normalizeAddress(wallet);
  const user = referrer ? await bindReferral(normalizedWallet, referrer) : await ensureUser(normalizedWallet);
  const stats = await buildStats(normalizedWallet);
  const rewards = await getRewards(normalizedWallet);
  const purchases = await getArray('purchases', normalizedWallet);
  const earnings = await getArray('earnings', normalizedWallet);
  const withdrawals = await getArray('withdrawals', normalizedWallet);
  const link = referralLink(normalizedWallet, origin);
  const labPassActive = safeNumber(user.labPassExpiration) * 1000 > Date.now();
  const toolsUnlocked = labPassActive ? defaultConfig.toolsUnlockedWithLabPass : 0;

  return {
    profile: user,
    config: defaultConfig,
    referralLink: link,
    shortReferralLink: link.replace(/^https?:\/\//i, ''),
    rewards,
    stats,
    purchases: purchases.slice(-12).reverse(),
    earnings: earnings.slice(-12).reverse(),
    withdrawals: withdrawals.slice(-12).reverse(),
    materials: buildMaterials(normalizedWallet, origin),
    accountProgress: {
      labPass: labPassActive ? 'Active' : 'Inactive',
      partnerRank: rankFromReferrals(stats.totalReferrals),
      toolsUnlocked,
      toolsTotal: defaultConfig.toolsTotal,
      lifetimeSavings: Number((toolsUnlocked * defaultConfig.labPassReferenceUsd).toFixed(2)),
      lifetimeEarnings: Number(rewards.earned.toFixed(2))
    },
    database: storageInfo()
  };
}

async function requestWithdraw(body) {
  const wallet = normalizeAddress(body.wallet);
  const amount = safeNumber(body.amount);
  const signature = String(body.signature || '');
  const message = String(body.message || '');
  const rewards = await getRewards(wallet);

  if (!signature || !message) {
    throw new Error('Wallet signature required.');
  }

  if (amount < defaultConfig.minimumWithdraw) {
    throw new Error(`Minimum withdrawal is ${defaultConfig.minimumWithdraw} ${defaultConfig.currency}.`);
  }

  if (amount > rewards.available) {
    throw new Error('Requested amount exceeds available balance.');
  }

  rewards.available = Number((rewards.available - amount).toFixed(6));
  rewards.pending = Number((rewards.pending + amount).toFixed(6));
  rewards.lastWithdrawal = nowIso();
  await saveRewards(rewards);

  const withdrawals = await getArray('withdrawals', wallet);
  const withdrawal = {
    id: `wd_${Date.now()}_${wallet.slice(2, 8)}`,
    wallet,
    amount,
    currency: defaultConfig.currency,
    status: 'pending_owner_payout',
    txHash: '',
    createdAt: nowIso(),
    signature,
    message
  };
  withdrawals.push(withdrawal);
  await setArray('withdrawals', wallet, withdrawals);

  return withdrawal;
}

async function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  try {
    return JSON.parse(req.body);
  } catch (error) {
    return {};
  }
}

function readOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '0xb20.lol';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function setHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function createHandler(action) {
  return async function handler(req, res) {
    setHeaders(res);

    try {
      const body = await parseBody(req);
      const wallet = req.query?.wallet || body.wallet;
      const referrer = req.query?.referrer || body.referrer || '';
      const origin = readOrigin(req);

      if (action === 'withdraw') {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed.' });
          return;
        }

        res.status(200).json({ withdrawal: await requestWithdraw(body) });
        return;
      }

      if (action === 'purchase') {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed.' });
          return;
        }

        const expectedSecret = process.env.REFERRAL_ADMIN_SECRET || '';
        const providedSecret = req.headers['x-referral-admin-secret'] || body.adminSecret || '';

        if (!expectedSecret || providedSecret !== expectedSecret) {
          res.status(403).json({ error: 'Referral purchase ingest unavailable.' });
          return;
        }

        res.status(200).json(await recordPurchase(body));
        return;
      }

      if (action === 'bind') {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed.' });
          return;
        }

        if (!wallet || !isAddress(wallet)) {
          res.status(400).json({ error: 'Wallet address required.' });
          return;
        }

        const user = await bindReferral(wallet, referrer);
        res.status(200).json({ profile: user, database: storageInfo() });
        return;
      }

      if (!wallet || !isAddress(wallet)) {
        res.status(400).json({ error: 'Wallet address required.' });
        return;
      }

      const data = await dashboard(wallet, referrer, origin);

      if (action === 'profile') {
        res.status(200).json({ profile: data.profile, accountProgress: data.accountProgress, database: data.database });
        return;
      }

      if (action === 'stats') {
        res.status(200).json({ stats: data.stats, rewards: data.rewards, accountProgress: data.accountProgress });
        return;
      }

      if (action === 'history') {
        res.status(200).json({ purchases: data.purchases, earnings: data.earnings, withdrawals: data.withdrawals });
        return;
      }

      if (action === 'link') {
        res.status(200).json({ referralLink: data.referralLink, shortReferralLink: data.shortReferralLink });
        return;
      }

      if (action === 'materials') {
        res.status(200).json({ materials: data.materials });
        return;
      }

      if (action === 'tree') {
        res.status(200).json({ levels: data.stats.levels, config: data.config.levels });
        return;
      }

      res.status(200).json(data);
    } catch (error) {
      res.status(400).json({
        error: error && error.message ? error.message : 'Referral service unavailable.'
      });
    }
  };
}

module.exports = {
  createHandler,
  dashboard,
  bindReferral,
  calculateRewards,
  recordPurchase,
  getSyncState,
  setSyncState,
  defaultConfig,
  normalizeAddress,
  shortAddress
};
