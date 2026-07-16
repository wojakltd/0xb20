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

function monthIndex(month) {
  const key = String(month || '').toLowerCase().replace(/\./g, '');
  const months = {
    jan: 0,
    january: 0,
    янв: 0,
    январь: 0,
    января: 0,
    feb: 1,
    february: 1,
    фев: 1,
    февраль: 1,
    февраля: 1,
    mar: 2,
    march: 2,
    мар: 2,
    март: 2,
    марта: 2,
    apr: 3,
    april: 3,
    апр: 3,
    апрель: 3,
    апреля: 3,
    may: 4,
    мая: 4,
    jun: 5,
    june: 5,
    июн: 5,
    июнь: 5,
    июня: 5,
    jul: 6,
    july: 6,
    июл: 6,
    июль: 6,
    июля: 6,
    aug: 7,
    august: 7,
    авг: 7,
    август: 7,
    августа: 7,
    sep: 8,
    sept: 8,
    september: 8,
    сен: 8,
    сентябрь: 8,
    сентября: 8,
    oct: 9,
    october: 9,
    окт: 9,
    октябрь: 9,
    октября: 9,
    nov: 10,
    november: 10,
    ноя: 10,
    ноябрь: 10,
    ноября: 10,
    dec: 11,
    december: 11,
    дек: 11,
    декабрь: 11,
    декабря: 11
  };

  return Object.prototype.hasOwnProperty.call(months, key) ? months[key] : -1;
}

function parseClock(hour, minute, meridiem) {
  let normalizedHour = Number(hour);
  const normalizedMinute = Number(minute);
  const period = String(meridiem || '').toLowerCase();

  if (!Number.isFinite(normalizedHour) || !Number.isFinite(normalizedMinute)) {
    return null;
  }

  if (period === 'pm' && normalizedHour < 12) {
    normalizedHour += 12;
  }

  if (period === 'am' && normalizedHour === 12) {
    normalizedHour = 0;
  }

  return {
    hour: normalizedHour,
    minute: normalizedMinute
  };
}

function parseAbsoluteLabel(value) {
  const normalized = String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/·/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\sг\.?$/i, '')
    .trim();
  const english = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*([A-Za-zА-Яа-я.]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  const russian = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2})\s+([A-Za-zА-Яа-я.]+)\s+(\d{4})$/i);
  let parts = null;

  if (english) {
    parts = {
      hour: english[1],
      minute: english[2],
      meridiem: english[3],
      month: english[4],
      day: english[5],
      year: english[6]
    };
  } else if (russian) {
    parts = {
      hour: russian[1],
      minute: russian[2],
      meridiem: russian[3],
      day: russian[4],
      month: russian[5],
      year: russian[6]
    };
  }

  if (!parts) {
    return null;
  }

  const clock = parseClock(parts.hour, parts.minute, parts.meridiem);
  const month = monthIndex(parts.month);

  if (!clock || month < 0) {
    return null;
  }

  const parsed = new Date(Date.UTC(Number(parts.year), month, Number(parts.day), clock.hour, clock.minute));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

  const absolute = parseAbsoluteLabel(label);

  if (absolute) {
    return absolute;
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
  return Number.isNaN(direct.getTime()) ? null : direct.toISOString();
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

function parseMarkdown(markdown, account) {
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
    const createdAt = relativeToIso(timeLabel);
    const text = trimPostText(rest);
    const images = extractImages(block);

    if ((!text && !images.length) || !createdAt) {
      continue;
    }

    posts.push(normalizePost({
      id: `${username}-${statusId}`,
      displayName,
      username,
      avatar,
      text,
      createdAt,
      url: `https://x.com/${username}/status/${statusId}`,
      images
    }, account, 'reader'));

  }

  return posts;
}

async function fetchAccount(account, config) {
  const timeoutMs = Number(config.reader && config.reader.timeoutMs) || 12000;
  const retries = Number(config.reader && config.reader.retries) || 0;
  const maxPostsPerAccount = Number(config.maxPostsPerAccount) || 10;
  const url = `https://r.jina.ai/http://r.jina.ai/http://https://twitter.com/${encodeURIComponent(account.username)}`;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`Reader HTTP ${response.status}: ${body.slice(0, 180)}`);
      }

      const allPosts = parseMarkdown(body, account);
      const posts = allPosts.slice(0, maxPostsPerAccount);

      if (!posts.length) {
        throw new Error('Reader returned no parseable status posts.');
      }

      return {
        posts,
        parsed: allPosts.length,
        attempts: attempt + 1
      };
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        const message = error && error.message ? error.message : String(error);
        console.log(`[research:reader] ${account.username}: attempt ${attempt + 1} failed: ${message}`);
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error('Reader request failed.');
}

async function fetchPosts(accounts, context = {}) {
  const config = context.config || {};
  const requestDelayMs = Number(config.reader && config.reader.requestDelayMs) || Number(config.requestDelayMs) || 1000;
  const posts = [];
  const errors = [];
  const coverage = [];

  for (const account of accounts) {
    try {
      const accountResult = await fetchAccount(account, config);
      posts.push(...accountResult.posts);
      coverage.push({
        username: account.username,
        parsed: accountResult.parsed,
        returned: accountResult.posts.length,
        attempts: accountResult.attempts
      });
      console.log(`[research:reader] ${account.username}: ${accountResult.posts.length}/${accountResult.parsed} posts in ${accountResult.attempts} attempt(s)`);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.log(`[research:reader] ${account.username}: ${message}`);
      errors.push({
        provider: 'reader',
        username: account.username,
        message
      });
      coverage.push({
        username: account.username,
        parsed: 0,
        returned: 0,
        error: message
      });
    }

    await sleep(requestDelayMs);
  }

  return {
    posts,
    errors,
    diagnostics: {
      coverage
    }
  };
}

module.exports = {
  fetchPosts,
  getLatestPosts: fetchPosts
};
