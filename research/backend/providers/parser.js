const crypto = require('crypto');

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripHtml(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getTag(block, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(pattern);
  return match ? decodeEntities(match[1]).trim() : '';
}

function getAtomLink(block) {
  const match = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return match ? decodeEntities(match[1]).trim() : '';
}

function getEnclosures(block) {
  const urls = [];
  const enclosurePattern = /<(?:enclosure|media:content|media:thumbnail)[^>]+url=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = enclosurePattern.exec(block))) {
    urls.push(decodeEntities(match[1]).trim());
  }

  return Array.from(new Set(urls));
}

function getRelativeTime(dateString) {
  const date = new Date(dateString);

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

function toIsoDate(dateString) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function createStableId(username, link, date, text) {
  const source = `${username}|${link}|${date}|${text}`;
  return crypto.createHash('sha1').update(source).digest('hex');
}

function toPost(item, account) {
  const title = stripHtml(getTag(item, 'title'));
  const description = stripHtml(getTag(item, 'description') || getTag(item, 'content:encoded') || getTag(item, 'summary'));
  const link = getTag(item, 'link') || getAtomLink(item);
  const guid = getTag(item, 'guid') || getTag(item, 'id');
  const createdAt = getTag(item, 'pubDate') || getTag(item, 'updated') || getTag(item, 'published') || new Date().toISOString();
  const normalizedDate = toIsoDate(createdAt);
  const text = description || title || 'Observation captured without readable text.';
  const images = getEnclosures(item).filter((url) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url));
  const video = getEnclosures(item).find((url) => /\.(mp4|webm|mov)(\?|$)/i.test(url)) || '';
  const postUrl = /(?:x|twitter)\.com/i.test(link) ? link : link || `https://x.com/${account.username}`;

  return {
    id: guid || createStableId(account.username, postUrl, createdAt, text),
    author: account.displayName || account.username,
    username: account.username,
    avatar: account.avatar || '',
    verified: Boolean(account.verified),
    text,
    created_at: normalizedDate,
    relative_time: getRelativeTime(normalizedDate),
    images,
    video,
    post_url: postUrl,
    likes: 0,
    replies: 0,
    reposts: 0,
    category: account.category || 'community',
    network: account.network || 'BASE',
    partner: Boolean(account.partner),
    partner_label: account.partnerLabel || ''
  };
}

function parseFeed(xml, account) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => toPost(block, account));
}

module.exports = {
  parseFeed
};
