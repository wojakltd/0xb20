const crypto = require('crypto');

function cleanText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function toIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getRelativeTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'time unknown';
  }

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
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

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/,/g, '');
  const match = normalized.match(/([\d.]+)\s*([km])?/);

  if (!match) {
    return 0;
  }

  const base = Number(match[1]);
  const multiplier = match[2] === 'm' ? 1000000 : match[2] === 'k' ? 1000 : 1;
  return Number.isFinite(base) ? Math.round(base * multiplier) : 0;
}

function createStableId(source) {
  const seed = [
    source.username,
    source.post_url || source.url,
    source.created_at || source.createdAt,
    source.text
  ].join('|');

  return crypto.createHash('sha1').update(seed).digest('hex');
}

function normalizePost(source, account = {}, provider = 'unknown') {
  const username = String(source.username || account.username || 'unknown').replace(/^@/, '');
  const displayName = String(source.displayName || source.author || account.displayName || username);
  const createdAt = toIsoDate(source.created_at || source.createdAt || source.created_at_iso);
  const postUrl = String(source.post_url || source.url || `https://x.com/${username}`);
  const text = cleanText(source.text || source.content || source.summary);

  return {
    id: String(source.id || createStableId({ ...source, username, post_url: postUrl, text })),
    author: displayName,
    displayName,
    username,
    avatar: String(source.avatar || account.avatar || ''),
    verified: Boolean(source.verified || account.verified),
    text: text || 'Observation captured without readable text.',
    created_at: createdAt,
    createdAt,
    relative_time: String(source.relative_time || source.relativeTime || getRelativeTime(createdAt)),
    images: unique(source.images).filter((url) => /^https?:\/\//i.test(url)),
    video: String(source.video || ''),
    post_url: postUrl,
    url: postUrl,
    likes: toNumber(source.likes),
    replies: toNumber(source.replies),
    reposts: toNumber(source.reposts),
    category: String(source.category || account.category || 'community').toLowerCase(),
    network: String(source.network || account.network || 'BASE').toUpperCase(),
    partner: Boolean(source.partner || account.partner),
    partner_label: String(source.partner_label || source.partnerLabel || account.partnerLabel || ''),
    source: provider
  };
}

module.exports = {
  cleanText,
  getRelativeTime,
  normalizePost,
  toIsoDate,
  toNumber,
  unique
};
