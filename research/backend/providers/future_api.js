async function fetchPosts() {
  throw new Error('future_api provider is not configured yet.');
}

module.exports = {
  fetchPosts,
  getLatestPosts: fetchPosts
};
