const rssProvider = require('./rss');
const futureApiProvider = require('./future_api');

const providers = {
  rss: rssProvider,
  future_api: futureApiProvider
};

function createProvider(config) {
  const providerName = config.activeProvider || 'rss';
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`Unknown research provider: ${providerName}`);
  }

  return provider;
}

module.exports = {
  createProvider
};
