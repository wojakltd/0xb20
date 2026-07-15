const { cleanText, normalizePost, unique } = require('./normalizer');

function sleep(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    headers: {
      accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1',
      'user-agent': '0XB20-Laboratory-Research/1.0'
    },
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
}

function markdownToText(value) {
  return cleanText(String(value || '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\s+\[\]\([^)]+\)/g, ' ')
    .replace(/\bShow more\b/gi, '')
    .replace(/(?:\s+\d+){2,5}$/g, '')
    .replace(/\s{2,}/g, ' '));
}

function profileDisplayName(markdown, account) {
  const title = markdown.match(/^Title:\s*(.*?)\s*\(@/m);
  return title ? title[1].trim() : account.displayName || account.username;
}

function profileAvatar(markdown) {
  const avatar = markdown.match(/!\[[^\]]*(?:avatar|Image\s+\d+)[^\]]*]\((https:\/\/pbs\.twimg\.com\/profile_images\/[^)]+)\)/i);
  return avatar ? avatar[1] : '';
}

function relativeToIso(label) {
  const now = new Date();
  const value = String(label || '').trim().toLowerCase();
  const relative = value.match(/^(\d+)(s|m|h|d)$/);

  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const milliseconds = unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60000
        : unit === 'h'
          ? amount * 3600000
          : amount * 86400000;

    return new Date(now.getTime() - milliseconds).toISOString();
  }

  const monthDay = value.match(/^([a-z]{3})\s+(\d{1,2})$/i);

  if (monthDay) {
    const parsed = new Date(`${monthDay[1]} ${monthDay[2]}, ${now.getUTCFullYear()} 12:00:00 UTC`);

    if (!Number.isNaN(parsed.getTime())) {
      if (parsed.getTime() > now.getTime() + 86400000) {
        parsed.setUTCFullYear(parsed.getUTCFullYear() - 1);
      }

      return parsed.toISOString();
    }
  }

  const direct = new Date(label);
  return Number.isNaN(direct.getTime()) ? now.toISOString() : direct.toISOString();
}

function extractImages(block) {
  const images = [];
  const imagePattern = /https:\/\/pbs\.twimg\.com\/(?:media|amplify_video_thumb)\/[^)\s]+/gi;
  let match;

  while ((match = imagePattern.exec(block))) {
    images.push(match[0]);
  }

  return unique(images);
}

function trimPostText(rawText) {
  const stopPatterns = [
    /\s+\[Video\s+\d+]/i,
    /\s+!\[Image/i,
    /\s+\[!\[Image/i,
    /\s+\[\]\(https:\/\/twitter\.com\/[^)]+\/photo\//i,
    /\s+\[\]\(https:\/\/twitter\.com\/[^)]+\/quotes\)/i
  ];
  const indexes = stopPatterns
    .map((pattern) => {
      const match = rawText.match(pattern);
      return match ? match.index : -1;
    })
    .filter((index) => index >= 0);
  const end = indexes.length ? Math.min(...indexes) : rawText.length;

  return markdownToText(rawText.slice(0, end));
}

function parseMarkdown(markdown, account, limit) {
  const username = String(account.username || '').replace(/^@/, '');
  const escapedUsername = escapeRegex(username);
  const displayName = profileDisplayName(markdown, account);
  const avatar = profileAvatar(markdown);
  const blocks = markdown.split(/\n\*\s+/g);
  const posts = [];
  const statusPattern = new RegExp(`\\[([^\\]]+)]\\(https:\\/\\/twitter\\.com\\/${escapedUsername}\\/status\\/(\\d+)\\)\\s+([\\s\\S]*)`, 'i');

  for (const block of blocks) {
    const match = block.match(statusPattern);

    if (!match) {
      continue;
    }

    const [, timeLabel, statusId, rest] = match;
    const text = trimPostText(rest);
    const images = extractImages(block);

    if (!text && !images.length) {
      continue;
    }

    posts.push(normalizePost({
      id: `${username}-${statusId}`,
      displayName,
      username,
      avatar,
      text,
      createdAt: relativeToIso(timeLabel),
      url: `https://x.com/${username}/status/${statusId}`,
      images
    }, account, 'reader'));

    if (posts.length >= limit) {
      break;
    }
  }

  return posts;
}

async function fetchAccount(account, config) {
  const timeoutMs = Number(config.reader && config.reader.timeoutMs) || 12000;
  const maxPostsPerAccount = Number(config.maxPostsPerAccount) || 10;
  const url = `https://r.jina.ai/http://r.jina.ai/http://https://twitter.com/${encodeURIComponent(account.username)}`;
  const response = await fetchWithTimeout(url, timeoutMs);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Reader HTTP ${response.status}: ${body.slice(0, 180)}`);
  }

  const posts = parseMarkdown(body, account, maxPostsPerAccount);

  if (!posts.length) {
    throw new Error('Reader returned no parseable status posts.');
  }

  return posts;
}

async function fetchPosts(accounts, context = {}) {
  const config = context.config || {};
  const requestDelayMs = Number(config.reader && config.reader.requestDelayMs) || Number(config.requestDelayMs) || 1000;
  const posts = [];
  const errors = [];

  for (const account of accounts) {
    try {
      const accountPosts = await fetchAccount(account, config);
      posts.push(...accountPosts);
      console.log(`[research:reader] ${account.username}: ${accountPosts.length} posts`);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.log(`[research:reader] ${account.username}: ${message}`);
      errors.push({
        provider: 'reader',
        username: account.username,
        message
      });
    }

    await sleep(requestDelayMs);
  }

  return { posts, errors };
}

module.exports = {
  fetchPosts,
  getLatestPosts: fetchPosts
};
