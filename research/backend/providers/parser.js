const { normalizePost } = require('./normalizer');

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

function toIsoDate(dateString) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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

  return normalizePost({
    id: guid,
    displayName: account.displayName || account.username,
    username: account.username,
    avatar: account.avatar || '',
    verified: Boolean(account.verified),
    text,
    createdAt: normalizedDate,
    images,
    video,
    url: postUrl,
    likes: 0,
    replies: 0,
    reposts: 0,
    category: account.category || 'community',
    network: account.network || 'BASE',
    partner: Boolean(account.partner),
    partner_label: account.partnerLabel || ''
  }, account, 'rss');
}

function parseFeed(xml, account) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => toPost(block, account));
}

module.exports = {
  parseFeed
};
