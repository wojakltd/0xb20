const fs = require('fs');
const path = require('path');
const {
  defaultConfig,
  getSyncState,
  normalizeAddress,
  recordPurchase,
  setSyncState
} = require('./referral-service');

const BASE_RPC_URL = 'https://mainnet.base.org';
const SYNC_NAME = 'laboratory-license-manager';
const DEFAULT_CONFIRMATIONS = 3;
const DEFAULT_BLOCK_CHUNK = 5000;
const DEFAULT_MAX_CHUNKS = 30;

function readConfig() {
  const configPath = path.join(process.cwd(), 'data', 'web3-tools.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  return config.premium || {};
}

function toRpcHex(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function fromRpcHex(value) {
  return Number(BigInt(value || '0x0'));
}

function cleanHex(value) {
  return String(value || '0x').replace(/^0x/i, '');
}

function dataWord(data, index) {
  const hex = cleanHex(data);
  const start = index * 64;
  const word = hex.slice(start, start + 64);
  return word ? `0x${word}` : '0x0';
}

function wordCount(data) {
  const hex = cleanHex(data);
  return hex ? Math.floor(hex.length / 64) : 0;
}

function topicAddress(topic) {
  const hex = cleanHex(topic);
  if (hex.length < 40) {
    return '';
  }
  return normalizeAddress(`0x${hex.slice(-40)}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rpcCall(rpcUrl, method, params, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Base RPC rejected ${method} (${response.status}).`);
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(payload.error.message || `Base RPC failed ${method}.`);
    }

    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry(label, fn, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await delay(600 * attempt);
      }
    }
  }

  throw new Error(`${label}: ${lastError && lastError.message ? lastError.message : 'request failed.'}`);
}

function decodeLicenseLog(log) {
  const topics = log.topics || [];
  const words = wordCount(log.data);

  // The license contract emits:
  // LicensePurchased(account indexed, paymentToken indexed, paid, expiresAt)
  // LicenseExtended(account indexed, paymentToken indexed, paid, previousExpiresAt, expiresAt)
  // Other events in the same contract have a different indexed/data shape.
  if (topics.length < 3 || (words !== 2 && words !== 3)) {
    return null;
  }

  const paidRaw = BigInt(dataWord(log.data, 0));
  const expiresAtRaw = BigInt(dataWord(log.data, words - 1));

  if (paidRaw <= 0n || expiresAtRaw <= 0n) {
    return null;
  }

  return {
    eventName: words === 2 ? 'LicensePurchased' : 'LicenseExtended',
    account: topicAddress(topics[1]),
    paymentToken: topicAddress(topics[2]),
    paidRaw: paidRaw.toString(),
    expiresAt: Number(expiresAtRaw),
    txHash: log.transactionHash,
    blockNumber: fromRpcHex(log.blockNumber)
  };
}

async function blockTimestamp(rpcUrl, blockNumber, cache) {
  if (cache.has(blockNumber)) {
    return cache.get(blockNumber);
  }

  const block = await withRetry(`Block ${blockNumber}`, () => rpcCall(rpcUrl, 'eth_getBlockByNumber', [
    toRpcHex(blockNumber),
    false
  ]));
  const timestamp = block && block.timestamp
    ? new Date(fromRpcHex(block.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  cache.set(blockNumber, timestamp);
  return timestamp;
}

function accountingPayload(config, event, timestamp) {
  const amount = Number(process.env.LAB_PASS_ACCOUNTING_USD || defaultConfig.labPassReferenceUsd || 10);
  const currency = String(process.env.LAB_PASS_ACCOUNTING_CURRENCY || defaultConfig.currency || 'USDC').toUpperCase();

  return {
    wallet: event.account,
    amount,
    currency,
    txHash: event.txHash,
    timestamp,
    labPassExpiration: event.expiresAt,
    source: 'license-indexer',
    eventName: event.eventName,
    blockNumber: event.blockNumber,
    paymentToken: event.paymentToken,
    paymentRaw: event.paidRaw,
    contractAddress: config.contractAddress
  };
}

function safePositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

async function syncLicensePurchases(options = {}) {
  const config = readConfig();
  const contractAddress = normalizeAddress(config.contractAddress || '');
  const deploymentBlock = safePositiveInt(
    options.startBlock || process.env.LAB_PASS_DEPLOYMENT_BLOCK || config.deploymentBlock,
    0
  );

  if (!contractAddress) {
    throw new Error('LaboratoryLicenseManager address is missing.');
  }

  if (!deploymentBlock) {
    throw new Error('LaboratoryLicenseManager deployment block is missing.');
  }

  const rpcUrl = process.env.BASE_RPC_URL || process.env.REFERRAL_BASE_RPC_URL || BASE_RPC_URL;
  const confirmations = safePositiveInt(options.confirmations || process.env.REFERRAL_SYNC_CONFIRMATIONS, DEFAULT_CONFIRMATIONS);
  const blockChunk = safePositiveInt(options.blockChunk || process.env.REFERRAL_SYNC_BLOCK_CHUNK, DEFAULT_BLOCK_CHUNK);
  const maxChunks = safePositiveInt(options.maxChunks || process.env.REFERRAL_SYNC_MAX_CHUNKS, DEFAULT_MAX_CHUNKS);
  const latestRaw = await withRetry('Latest Base block', () => rpcCall(rpcUrl, 'eth_blockNumber', []));
  const latestBlock = Math.max(0, fromRpcHex(latestRaw) - confirmations);
  const state = await getSyncState(SYNC_NAME);
  const previousBlock = options.force
    ? deploymentBlock - 1
    : safePositiveInt(state.lastIndexedBlock, deploymentBlock - 1);
  let cursor = Math.max(deploymentBlock, previousBlock + 1);

  const stats = {
    provider: 'Base RPC',
    contractAddress,
    deploymentBlock,
    latestBlock,
    startedFromBlock: cursor,
    lastIndexedBlock: previousBlock,
    chunks: 0,
    logsRead: 0,
    purchaseEvents: 0,
    purchasesRecorded: 0,
    duplicatePurchases: 0,
    hasMore: false,
    updatedAt: new Date().toISOString()
  };

  if (cursor > latestBlock) {
    stats.lastIndexedBlock = previousBlock;
    return stats;
  }

  const timestampCache = new Map();

  while (cursor <= latestBlock && stats.chunks < maxChunks) {
    const toBlock = Math.min(latestBlock, cursor + blockChunk - 1);
    const logs = await withRetry(`License logs ${cursor}-${toBlock}`, () => rpcCall(rpcUrl, 'eth_getLogs', [{
      address: contractAddress,
      fromBlock: toRpcHex(cursor),
      toBlock: toRpcHex(toBlock)
    }]));

    stats.chunks += 1;
    stats.logsRead += Array.isArray(logs) ? logs.length : 0;

    for (const log of logs || []) {
      const event = decodeLicenseLog(log);

      if (!event) {
        continue;
      }

      stats.purchaseEvents += 1;
      const timestamp = await blockTimestamp(rpcUrl, event.blockNumber, timestampCache);
      const result = await recordPurchase(accountingPayload(config, event, timestamp));

      if (result.duplicate) {
        stats.duplicatePurchases += 1;
      } else {
        stats.purchasesRecorded += 1;
      }
    }

    await setSyncState(SYNC_NAME, {
      lastIndexedBlock: toBlock,
      updatedAt: new Date().toISOString(),
      contractAddress,
      latestBlock,
      provider: stats.provider
    });

    stats.lastIndexedBlock = toBlock;
    cursor = toBlock + 1;
  }

  stats.hasMore = cursor <= latestBlock;
  stats.nextBlock = stats.hasMore ? cursor : null;
  stats.updatedAt = new Date().toISOString();
  return stats;
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

function providedSecret(req, body) {
  const authorization = req.headers.authorization || '';

  if (/^bearer\s+/i.test(authorization)) {
    return authorization.replace(/^bearer\s+/i, '').trim();
  }

  return req.headers['x-referral-admin-secret'] || body.adminSecret || '';
}

function createSyncHandler() {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    const body = await parseBody(req);
    const expectedSecret = process.env.REFERRAL_ADMIN_SECRET || '';

    if (!expectedSecret || providedSecret(req, body) !== expectedSecret) {
      res.status(403).json({ error: 'Referral sync unavailable.' });
      return;
    }

    try {
      const result = await syncLicensePurchases({
        force: Boolean(body.force),
        startBlock: body.startBlock,
        maxChunks: body.maxChunks,
        blockChunk: body.blockChunk,
        confirmations: body.confirmations
      });
      res.status(200).json({ ok: true, result });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error && error.message ? error.message : 'Referral sync failed.'
      });
    }
  };
}

module.exports = {
  createSyncHandler,
  syncLicensePurchases
};
