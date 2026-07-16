(function () {
  const accessStorageKey = 'b20-research-access';
  const accessPassword = '0xb20.lol';
  const cachePath = 'backend/cache/feed.json';
  const pageSize = 12;
  const refreshIntervalMs = 120000;
  const laboratoryPriorityWindowMs = 15 * 60 * 1000;
  const categoryOrder = ['all', 'laboratory', 'official', 'team', 'community', 'builders', 'protocols', 'funds', 'partners'];
  const categoryLabels = {
    all: 'All',
    laboratory: 'Laboratory',
    official: 'Official',
    team: 'Team',
    community: 'Community',
    builders: 'Builders',
    protocols: 'Protocols',
    funds: 'Funds',
    partners: 'Partners'
  };
  const state = {
    metadata: null,
    posts: [],
    filteredPosts: [],
    visibleCount: pageSize,
    activeCategory: 'all',
    query: ''
  };

  const feedTarget = document.querySelector('[data-research-feed]');
  const filterTarget = document.querySelector('[data-research-filters]');
  const searchInput = document.querySelector('[data-research-search]');
  const countTarget = document.querySelector('[data-research-count]');
  const sentinel = document.querySelector('[data-research-sentinel]');
  const gateTarget = document.querySelector('[data-research-gate]');
  const gateForm = document.querySelector('[data-research-gate-form]');
  const passwordInput = document.querySelector('[data-research-password]');
  const gateError = document.querySelector('[data-research-gate-error]');
  const protectedContent = document.querySelector('[data-research-content]');
  const statusTarget = document.querySelector('[data-research-status]');
  const debugTarget = document.querySelector('[data-research-debug]');
  const debugOutput = document.querySelector('[data-research-debug-output]');
  const modal = document.querySelector('[data-research-modal]');
  const modalImage = document.querySelector('[data-research-modal-image]');
  const modalClose = document.querySelector('[data-research-modal-close]');
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';
  let isResearchInitialized = false;
  let refreshTimer = null;

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function formatCategory(category) {
    const key = String(category || 'community').toLowerCase();
    return categoryLabels[key] || key.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatProvider(provider) {
    const value = String(provider || 'unknown').replace(/[_-]/g, ' ');
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en').format(Number(value) || 0);
  }

  function getTimestamp(value) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function getPriorityBoost(post) {
    return post.category === 'laboratory' ? laboratoryPriorityWindowMs : 0;
  }

  function sortPosts(posts) {
    return posts.sort((first, second) => {
      const firstScore = getTimestamp(first.created_at) + getPriorityBoost(first);
      const secondScore = getTimestamp(second.created_at) + getPriorityBoost(second);

      if (secondScore !== firstScore) {
        return secondScore - firstScore;
      }

      return getTimestamp(second.created_at) - getTimestamp(first.created_at);
    });
  }

  function formatRelativeTime(value) {
    const timestamp = getTimestamp(value);

    if (!timestamp) {
      return 'time unknown';
    }

    const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
    const units = [
      ['y', 31536000],
      ['mo', 2592000],
      ['d', 86400],
      ['h', 3600],
      ['m', 60]
    ];

    for (const [label, size] of units) {
      const amount = Math.floor(seconds / size);

      if (amount >= 1) {
        return `${amount}${label} ago`;
      }
    }

    return `${seconds}s ago`;
  }

  function normalizePost(post) {
    const source = post && typeof post === 'object' ? post : {};
    const category = String(source.category || 'community').toLowerCase();
    const username = String(source.username || 'unknown').replace(/^@/, '');
    const displayName = String(source.displayName || source.author || username || 'Unknown Subject');

    return {
      id: String(source.id || `${username}-${source.created_at || Date.now()}`),
      author: displayName,
      displayName,
      username,
      avatar: String(source.avatar || source.logo || ''),
      verified: Boolean(source.verified),
      text: String(source.text || 'Observation captured without readable text.'),
      created_at: String(source.created_at || source.createdAt || new Date().toISOString()),
      createdAt: String(source.createdAt || source.created_at || new Date().toISOString()),
      relative_time: String(source.relative_time || ''),
      images: Array.isArray(source.images) ? source.images : [],
      video: String(source.video || ''),
      post_url: String(source.post_url || source.url || `https://x.com/${username}`),
      url: String(source.url || source.post_url || `https://x.com/${username}`),
      likes: Number(source.likes) || 0,
      replies: Number(source.replies) || 0,
      reposts: Number(source.reposts) || 0,
      category,
      network: String(source.network || 'BASE').toUpperCase(),
      partner: Boolean(source.partner),
      partner_label: String(source.partner_label || source.partnerName || ''),
      priority: Number(source.priority) || 0,
      favorite: Boolean(source.favorite),
      source: String(source.source || '')
    };
  }

  function normalizePayload(data) {
    const rawPosts = Array.isArray(data) ? data : Array.isArray(data && data.posts) ? data.posts : [];
    const posts = sortPosts(rawPosts.map(normalizePost));
    const metadata = data && !Array.isArray(data) && data.metadata
      ? data.metadata
      : {
        version: 1,
        provider: posts[0] && posts[0].source ? posts[0].source : 'legacy cache',
        generatedAt: null,
        durationMs: 0,
        accounts: 0,
        posts: posts.length,
        latestObservationAt: posts[0] ? posts[0].created_at : null,
        refreshIntervalMinutes: 10,
        failures: []
      };

    return {
      metadata,
      posts
    };
  }

  async function loadFeed() {
    const response = await fetch(`${cachePath}?t=${Date.now()}`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Research feed unavailable: ${response.status}`);
    }

    return normalizePayload(await response.json());
  }

  function getInitials(username) {
    return username.slice(0, 2).toUpperCase();
  }

  function getReadableTime(post) {
    return formatRelativeTime(post.created_at) || post.relative_time || 'time unknown';
  }

  function getStatusField(name) {
    return statusTarget && statusTarget.querySelector(`[data-status-value="${name}"]`);
  }

  function renderStatus() {
    const metadata = state.metadata || {};
    const fields = {
      status: 'Online',
      provider: formatProvider(metadata.provider),
      latest: metadata.latestObservationAt ? formatRelativeTime(metadata.latestObservationAt) : 'Unknown',
      accounts: metadata.accounts ? formatNumber(metadata.accounts) : 'Unknown',
      posts: formatNumber(metadata.posts || state.posts.length),
      refresh: `Every ${metadata.refreshIntervalMinutes || 10} minutes`
    };

    Object.entries(fields).forEach(([name, value]) => {
      const field = getStatusField(name);

      if (field) {
        field.textContent = value;
      }
    });
  }

  function getFilterCounts() {
    const counts = new Map(categoryOrder.map((category) => [category, 0]));

    counts.set('all', state.posts.length);
    state.posts.forEach((post) => {
      counts.set(post.category, (counts.get(post.category) || 0) + 1);

      if (post.partner) {
        counts.set('partners', (counts.get('partners') || 0) + 1);
      }
    });

    return counts;
  }

  function getVisibleCategories(counts) {
    const dynamicCategories = Array.from(counts.keys()).filter((category) => !categoryOrder.includes(category));
    return [...categoryOrder, ...dynamicCategories].filter((category) => category === 'all' || (counts.get(category) || 0) > 0);
  }

  function renderFilters() {
    const counts = getFilterCounts();
    const buttons = getVisibleCategories(counts).map((category) => {
      const count = counts.get(category) || 0;
      const button = createElement('button', `research-filter is-${category}`, `${formatCategory(category)} (${count})`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category === state.activeCategory));
      button.addEventListener('click', () => {
        state.activeCategory = category;
        state.visibleCount = pageSize;
        renderFilters();
        applyFilters();
      });
      return button;
    });

    filterTarget.replaceChildren(...buttons);
  }

  function matchesPost(post) {
    const query = state.query.trim().toLowerCase();
    const categoryMatch = state.activeCategory === 'all'
      || post.category === state.activeCategory
      || (state.activeCategory === 'partners' && post.partner);

    if (!categoryMatch) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [post.username, post.displayName, post.author, post.text, post.category, post.network, post.partner_label]
      .some((value) => String(value).toLowerCase().includes(query));
  }

  function applyFilters() {
    state.filteredPosts = state.posts.filter(matchesPost);
    renderFeed(true);
  }

  function renderAvatar(post) {
    const avatar = createElement('span', 'research-avatar');

    if (post.avatar) {
      const image = document.createElement('img');
      image.src = post.avatar;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.remove();
        avatar.textContent = getInitials(post.username);
      }, { once: true });
      avatar.append(image);
      return avatar;
    }

    avatar.textContent = getInitials(post.username);
    return avatar;
  }

  function openMediaModal(source) {
    if (!modal || !modalImage || !source) {
      return;
    }

    modalImage.src = source;
    modal.hidden = false;
    document.body.classList.add('research-modal-open');
  }

  function closeMediaModal() {
    if (!modal || !modalImage) {
      return;
    }

    modal.hidden = true;
    modalImage.removeAttribute('src');
    document.body.classList.remove('research-modal-open');
  }

  function renderMedia(post) {
    if (!post.images.length && !post.video) {
      return null;
    }

    const media = createElement('div', 'research-media');

    post.images.slice(0, 4).forEach((source) => {
      const button = createElement('button', 'research-media-button');
      const image = document.createElement('img');

      button.type = 'button';
      button.setAttribute('aria-label', 'Open observation media');
      image.src = source;
      image.alt = 'Research observation media';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
      button.addEventListener('click', () => openMediaModal(source));
      button.append(image);
      media.append(button);
    });

    if (post.video) {
      const video = document.createElement('video');
      video.className = 'research-video';
      video.src = post.video;
      video.controls = true;
      video.preload = 'metadata';
      media.append(video);
    }

    return media;
  }

  function renderCard(post) {
    const card = createElement('article', `research-card is-${post.category}`);
    const header = createElement('header', 'research-card-header');
    const identity = createElement('div', 'research-identity');
    const nameRow = createElement('div', 'research-name-row');
    const author = createElement('span', 'research-author', post.displayName);
    const verified = post.verified ? createElement('span', 'research-verified', 'VERIFIED') : null;
    const username = createElement('span', 'research-username', `@${post.username}`);
    const categoryBadge = createElement('span', `research-badge is-${post.category}`, formatCategory(post.category));
    const network = createElement('span', 'research-network', post.network);
    const time = createElement('span', 'research-time', getReadableTime(post));
    const partner = post.partner ? createElement('span', 'research-partner', post.partner_label || 'PARTNER') : null;
    const text = createElement('p', 'research-text', post.text);
    const actions = createElement('div', 'research-actions');
    const open = createElement('a', 'research-open', 'Open on X');
    const media = renderMedia(post);

    open.href = post.post_url;
    open.target = '_blank';
    open.rel = 'noreferrer';
    nameRow.append(author);

    if (verified) {
      nameRow.append(verified);
    }

    nameRow.append(username, categoryBadge, network, time);

    if (partner) {
      nameRow.append(partner);
    }

    identity.append(nameRow);
    header.append(renderAvatar(post), identity);
    actions.append(open);
    card.append(header, text);

    if (media) {
      card.append(media);
    }

    card.append(actions);
    return card;
  }

  function renderFeed(reset) {
    const visiblePosts = state.filteredPosts.slice(0, state.visibleCount);

    if (countTarget) {
      countTarget.textContent = `${state.filteredPosts.length} observations`;
    }

    if (!visiblePosts.length) {
      feedTarget.replaceChildren(createElement('p', 'research-empty', 'Research feed temporarily unavailable. Observation continues...'));
      return;
    }

    if (reset) {
      feedTarget.replaceChildren(...visiblePosts.map(renderCard));
      return;
    }

    const renderedCount = feedTarget.querySelectorAll('.research-card').length;
    const nextPosts = visiblePosts.slice(renderedCount);

    if (nextPosts.length) {
      feedTarget.append(...nextPosts.map(renderCard));
    }
  }

  function revealMore() {
    if (state.visibleCount >= state.filteredPosts.length) {
      return;
    }

    state.visibleCount += pageSize;
    renderFeed(false);
  }

  function initInfiniteScroll() {
    if (!sentinel || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        revealMore();
      }
    }, { rootMargin: '320px' });

    observer.observe(sentinel);
  }

  function getCacheAge(metadata) {
    if (!metadata || !metadata.generatedAt) {
      return 'unknown';
    }

    return formatRelativeTime(metadata.generatedAt);
  }

  function renderDebug() {
    if (!isDebugMode || !debugTarget || !debugOutput) {
      return;
    }

    const metadata = state.metadata || {};
    debugTarget.hidden = false;
    debugOutput.textContent = JSON.stringify({
      provider: metadata.provider || 'unknown',
      durationMs: metadata.durationMs || 0,
      lastUpdate: metadata.generatedAt || null,
      providerFailures: metadata.failures || [],
      coverage: metadata.coverage || [],
      accountsScanned: metadata.accountsScanned || metadata.accounts || 0,
      postsCollected: metadata.postsCollected || state.posts.length,
      cacheAge: getCacheAge(metadata),
      networks: metadata.networks || [],
      categories: metadata.categories || []
    }, null, 2);
  }

  async function refreshFeed(isInitialLoad) {
    try {
      const payload = await loadFeed();
      const previousFirstId = state.posts[0] && state.posts[0].id;
      const nextFirstId = payload.posts[0] && payload.posts[0].id;

      state.metadata = payload.metadata;
      state.posts = payload.posts;
      renderStatus();
      renderDebug();

      if (isInitialLoad || previousFirstId !== nextFirstId) {
        renderFilters();
        applyFilters();
      }
    } catch (error) {
      if (isInitialLoad) {
        feedTarget.replaceChildren(createElement('p', 'research-empty', 'Research feed temporarily unavailable. Observation continues...'));
      }
    }
  }

  function initSearch() {
    let timeout;

    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        state.query = searchInput.value;
        state.visibleCount = pageSize;
        applyFilters();
      }, 80);
    });
  }

  function hasStoredAccess() {
    try {
      return window.sessionStorage.getItem(accessStorageKey) === 'granted';
    } catch (error) {
      return false;
    }
  }

  function storeAccess() {
    try {
      window.sessionStorage.setItem(accessStorageKey, 'granted');
    } catch (error) {
      // Temporary client-side gate: if storage is blocked, keep access for the current render only.
    }
  }

  async function unlockResearch() {
    storeAccess();

    if (gateTarget) {
      gateTarget.hidden = true;
    }

    if (protectedContent) {
      protectedContent.hidden = false;
    }

    await initResearch();
  }

  async function initResearch() {
    const ui = window.B20UI;

    if (isResearchInitialized || !feedTarget || !filterTarget || !searchInput) {
      return;
    }

    isResearchInitialized = true;

    if (ui) {
      ui.initReveal();
    }

    renderFilters();
    initSearch();
    initInfiniteScroll();
    await refreshFeed(true);

    if (!refreshTimer) {
      refreshTimer = setInterval(() => refreshFeed(false), refreshIntervalMs);
    }
  }

  function initAccessGate() {
    if (!gateTarget || !protectedContent || !gateForm || !passwordInput) {
      initResearch();
      return;
    }

    if (hasStoredAccess()) {
      unlockResearch();
      return;
    }

    gateTarget.hidden = false;
    protectedContent.hidden = true;

    window.requestAnimationFrame(() => {
      passwordInput.focus({ preventScroll: true });
    });

    gateForm.addEventListener('submit', (event) => {
      event.preventDefault();

      if (passwordInput.value.trim() === accessPassword) {
        unlockResearch();
        return;
      }

      if (gateError) {
        gateError.hidden = false;
      }

      passwordInput.select();
    });
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeMediaModal();
      }
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeMediaModal);
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMediaModal();
    }
  });

  document.addEventListener('DOMContentLoaded', initAccessGate);
})();
