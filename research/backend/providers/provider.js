const rssProvider = require('./rss');
const playwrightProvider = require('./playwright');
const readerProvider = require('./reader');
const sampleProvider = require('./sample');
const futureApiProvider = require('./future_api');

const providers = {
  playwright: playwrightProvider,
  reader: readerProvider,
  rss: rssProvider,
  sample: sampleProvider,
  future_api: futureApiProvider
};

function getProvider(providerName) {
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`Unknown research provider: ${providerName}`);
  }

  return provider;
}

function createProvider(config) {
  return getProvider(config.activeProvider || 'rss');
}

function getProviderOrder(config) {
  const order = Array.isArray(config.providerOrder) && config.providerOrder.length
    ? config.providerOrder
    : ['playwright', 'reader', 'rss', 'cache', 'sample'];

  return order.map((providerName) => String(providerName).toLowerCase());
}

module.exports = {
  createProvider,
  getProvider,
  getProviderOrder
};
