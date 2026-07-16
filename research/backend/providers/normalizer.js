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
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function getSnowflakeId(source) {
  const direct = String(source && source.id ? source.id : '').match(/(\d{12,})$/);

  if (direct) {
    return direct[1];
  }

  const url = String(source && (source.post_url || source.url) ? source.post_url || source.url : '');
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : '';
}

function snowflakeToIsoDate(source) {
  const id = getSnowflakeId(source);

  if (!id) {
    return '';
  }

  try {
    const timestamp = (BigInt(id) >> 22n) + 1288834974657n;
    const date = new Date(Number(timestamp));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  } catch (error) {
    return '';
  }
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
  const createdAt = snowflakeToIsoDate(source) || toIsoDate(source.created_at || source.createdAt || source.created_at_iso);
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
    video_preview: String(source.video_preview || source.videoPreview || ''),
    videoPreview: String(source.videoPreview || source.video_preview || ''),
    post_url: postUrl,
    url: postUrl,
    likes: toNumber(source.likes),
    replies: toNumber(source.replies),
    reposts: toNumber(source.reposts),
    category: String(source.category || account.category || 'community').toLowerCase(),
    network: String(source.network || account.network || 'BASE').toUpperCase(),
    partner: Boolean(source.partner || account.partner),
    partner_label: String(source.partner_label || source.partnerLabel || account.partnerName || account.partnerLabel || ''),
    priority: Number(source.priority ?? account.priority ?? 0) || 0,
    favorite: Boolean(source.favorite || account.favorite),
    description: String(source.description || account.description || ''),
    website: String(source.website || account.website || ''),
    logo: String(source.logo || account.logo || ''),
    conversation_id: String(source.conversation_id || source.conversationId || ''),
    in_reply_to_user_id: String(source.in_reply_to_user_id || source.inReplyToUserId || ''),
    referenced_tweets: Array.isArray(source.referenced_tweets) ? source.referenced_tweets : [],
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
