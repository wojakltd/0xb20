(function () {
  const accessStorageKey = 'b20-research-access';
  const accessPassword = '0xb20.lol';
  const cachePath = 'backend/cache/feed.json';
  const pageSize = 12;
  const refreshIntervalMs = 120000;
  const categories = ['all', 'official', 'team', 'community', 'builders', 'protocols', 'funds', 'partners'];
  const state = {
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
    return String(category || 'community').replace(/-/g, ' ');
  }

  function normalizePost(post) {
    const source = post && typeof post === 'object' ? post : {};

    return {
      id: String(source.id || `${source.username || 'unknown'}-${source.created_at || Date.now()}`),
      author: String(source.author || source.displayName || source.username || 'Unknown Subject'),
      displayName: String(source.displayName || source.author || source.username || 'Unknown Subject'),
      username: String(source.username || 'unknown'),
      avatar: String(source.avatar || ''),
      verified: Boolean(source.verified),
      text: String(source.text || 'Observation captured without readable text.'),
      created_at: String(source.created_at || source.createdAt || new Date().toISOString()),
      relative_time: String(source.relative_time || ''),
      images: Array.isArray(source.images) ? source.images : [],
      video: String(source.video || ''),
      post_url: String(source.post_url || source.url || `https://x.com/${source.username || ''}`),
      likes: Number(source.likes) || 0,
      replies: Number(source.replies) || 0,
      reposts: Number(source.reposts) || 0,
      category: String(source.category || 'community').toLowerCase(),
      network: String(source.network || 'BASE').toUpperCase(),
      partner: Boolean(source.partner),
      partner_label: String(source.partner_label || '')
    };
  }

  async function loadFeed() {
    const response = await fetch(`${cachePath}?t=${Date.now()}`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Research feed unavailable: ${response.status}`);
    }

    const data = await response.json();
    const posts = Array.isArray(data) ? data.map(normalizePost) : [];

    return posts.sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime());
  }

  function getInitials(username) {
    return username.slice(0, 2).toUpperCase();
  }

  function getReadableTime(post) {
    if (post.relative_time) {
      return post.relative_time;
    }

    const date = new Date(post.created_at);

    if (Number.isNaN(date.getTime())) {
      return 'time unknown';
    }

    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function renderFilters() {
    const buttons = categories.map((category) => {
      const button = createElement('button', 'research-filter', category === 'all' ? 'ALL' : formatCategory(category));
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

    return [post.username, post.author, post.text, post.category, post.network]
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
      avatar.append(image);
      return avatar;
    }

    avatar.textContent = getInitials(post.username);
    return avatar;
  }

  function renderMedia(post) {
    if (!post.images.length && !post.video) {
      return null;
    }

    const media = createElement('div', 'research-media');

    post.images.slice(0, 4).forEach((source) => {
      const image = document.createElement('img');
      image.src = source;
      image.alt = 'Research observation media';
      image.loading = 'lazy';
      media.append(image);
    });

    if (post.video) {
      const video = document.createElement('video');
      video.className = 'research-video';
      video.src = post.video;
      video.controls = true;
      video.preload = 'none';
      media.append(video);
    }

    return media;
  }

  function renderCard(post) {
    const card = createElement('article', 'research-card');
    const header = createElement('header', 'research-card-header');
    const identity = createElement('div', 'research-identity');
    const nameRow = createElement('div', 'research-name-row');
    const author = createElement('span', 'research-author', post.author);
    const verified = post.verified ? createElement('span', 'research-verified', 'VERIFIED') : null;
    const username = createElement('span', 'research-username', `@${post.username}`);
    const badge = createElement('span', post.partner ? 'research-badge is-partner' : 'research-badge', post.partner_label || formatCategory(post.category));
    const time = createElement('span', 'research-time', getReadableTime(post));
    const network = createElement('span', 'research-network', post.network);
    const text = createElement('p', 'research-text', post.text);
    const actions = createElement('div', 'research-actions');
    const stats = createElement('span', 'research-stats', `likes ${post.likes} / replies ${post.replies} / reposts ${post.reposts}`);
    const open = createElement('a', 'research-open', 'Open on X');
    const media = renderMedia(post);

    open.href = post.post_url;
    open.target = '_blank';
    open.rel = 'noreferrer';
    nameRow.append(author);

    if (verified) {
      nameRow.append(verified);
    }

    nameRow.append(username, badge, time, network);
    identity.append(nameRow);
    header.append(renderAvatar(post), identity);
    actions.append(stats, open);
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

  async function refreshFeed(isInitialLoad) {
    try {
      const nextPosts = await loadFeed();
      const previousFirstId = state.posts[0] && state.posts[0].id;
      const nextFirstId = nextPosts[0] && nextPosts[0].id;

      state.posts = nextPosts;

      if (isInitialLoad || previousFirstId !== nextFirstId) {
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
      }, 120);
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

  document.addEventListener('DOMContentLoaded', initAccessGate);
})();
