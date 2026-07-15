const { normalizePost } = require('./normalizer');

const samples = [
  ['base', 'official', 'Base ecosystem signal captured. Public research feed is calibrating against official network activity.'],
  ['buildonbase', 'official', 'Builder activity detected. The Laboratory is tracking new Base-native experiments.'],
  ['jessepollak', 'team', 'Founder signal observed. Research queue updated for ecosystem context.'],
  ['AerodromeFinance', 'protocols', 'Protocol observation recorded. Liquidity systems remain under active monitoring.'],
  ['virtuals_io', 'protocols', 'Autonomous agent activity entered the observation buffer.'],
  ['talentprotocol', 'protocols', 'Identity and reputation signal archived for future analysis.'],
  ['basedsnipez', 'builders', 'Builder terminal emitted a new Base signal.'],
  ['base_vietnam', 'community', 'Community relay active. Regional Base activity remains visible.'],
  ['cbventures', 'funds', 'Capital network signal indexed for long-range ecosystem research.'],
  ['a16zcrypto', 'funds', 'Research subject added to institutional observation layer.']
];

function fetchPosts(accounts) {
  const now = Date.now();
  const accountByUsername = new Map(accounts.map((account) => [String(account.username).toLowerCase(), account]));
  const posts = samples.map(([username, category, text], index) => {
    const account = accountByUsername.get(username.toLowerCase()) || { username, category, network: 'BASE' };
    const createdAt = new Date(now - index * 9 * 60000).toISOString();

    return normalizePost({
      id: `sample-${username}-${index}`,
      displayName: account.displayName || username,
      username,
      text,
      createdAt,
      url: `https://x.com/${username}`,
      category,
      network: 'BASE'
    }, account, 'sample');
  });

  console.log(`[research:sample] generated ${posts.length} development observations`);
  return { posts, errors: [] };
}

module.exports = {
  fetchPosts,
  getLatestPosts: fetchPosts
};
