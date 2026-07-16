const fs = require('fs');
const path = require('path');
const { cleanText } = require('./normalizer');

const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..', '..');
let envLoaded = false;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

function loadLocalEnv() {
  if (envLoaded) {
    return;
  }

  [
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env'),
    path.join(backendRoot, '.env.local'),
    path.join(backendRoot, '.env')
  ].forEach(loadEnvFile);

  envLoaded = true;
}

function getBearerToken() {
  loadLocalEnv();

  return [
    process.env.X_BEARER_TOKEN,
    process.env.X_API_BEARER_TOKEN,
    process.env.TWITTER_BEARER_TOKEN
  ].find(Boolean);
}

function getConfig(config = {}) {
  const xapiConfig = config.xapi || {};

  return {
    baseUrl: String(xapiConfig.baseUrl || 'https://api.x.com/2').replace(/\/$/, ''),
    timeoutMs: Number(xapiConfig.timeoutMs) || 15000,
    maxResults: Math.min(100, Math.max(5, Number(xapiConfig.maxResults) || 100)),
    maxPages: Math.max(1, Number(xapiConfig.maxPages) || 3),
    userFields: xapiConfig.userFields || 'created_at,description,id,name,profile_image_url,protected,public_metrics,url,username,verified,verified_type',
    tweetFields: xapiConfig.tweetFields || 'attachments,author_id,conversation_id,created_at,entities,id,in_reply_to_user_id,note_tweet,public_metrics,referenced_tweets,text',
    expansions: xapiConfig.expansions || 'attachments.media_keys,author_id',
    mediaFields: xapiConfig.mediaFields || 'alt_text,duration_ms,height,media_key,preview_image_url,public_metrics,type,url,variants,width'
  };
}

function toXDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildUrl(baseUrl, endpoint, params = {}) {
  const url = new URL(`${baseUrl}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) {
        url.searchParams.set(key, value.join(','));
      }
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

async function fetchJson(url, token, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'user-agent': '0XB20-Laboratory-Research/1.0'
      },
      signal: controller.signal
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const apiMessage = Array.isArray(data.errors)
        ? data.errors.map((error) => error.detail || error.title || error.message).filter(Boolean).join('; ')
        : data.detail || data.title || data.message || response.statusText;

      throw new Error(`X API ${response.status}: ${apiMessage}`);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getUserByUsername(username, config, token) {
  const url = buildUrl(config.baseUrl, `/users/by/username/${encodeURIComponent(username)}`, {
    'user.fields': config.userFields
  });
  const payload = await fetchJson(url, token, config.timeoutMs);

  if (!payload.data || !payload.data.id) {
    throw new Error(`X API returned no user for @${username}.`);
  }

  return payload.data;
}

function bestVideoVariant(media) {
  const variants = Array.isArray(media && media.variants) ? media.variants : [];
  const mp4 = variants
    .filter((variant) => String(variant.content_type || '').toLowerCase().includes('mp4') && variant.url)
    .sort((first, second) => (Number(second.bit_rate) || 0) - (Number(first.bit_rate) || 0));

  return mp4[0] ? mp4[0].url : '';
}

function normalizeMedia(tweet, mediaByKey) {
  const keys = tweet.attachments && Array.isArray(tweet.attachments.media_keys)
    ? tweet.attachments.media_keys
    : [];
  const images = [];
  let video = '';
  let videoPreview = '';

  keys.forEach((mediaKey) => {
    const media = mediaByKey.get(mediaKey);

    if (!media) {
      return;
    }

    if (media.type === 'photo' && media.url) {
      images.push(media.url);
      return;
    }

    if ((media.type === 'video' || media.type === 'animated_gif') && !video) {
      video = bestVideoVariant(media);
    }

    if ((media.type === 'video' || media.type === 'animated_gif') && media.preview_image_url && !videoPreview) {
      videoPreview = media.preview_image_url;
    }
  });

  return {
    images: Array.from(new Set(images)),
    video,
    videoPreview
  };
}

function replyTargetIds(tweet) {
  return (Array.isArray(tweet && tweet.referenced_tweets) ? tweet.referenced_tweets : [])
    .filter((reference) => reference && reference.type === 'replied_to' && reference.id)
    .map((reference) => String(reference.id));
}

function isReply(tweet) {
  return Boolean(tweet && (tweet.in_reply_to_user_id || replyTargetIds(tweet).length));
}

function isOwnThreadReply(tweet, user, ownTweetIds) {
  if (!isReply(tweet)) {
    return true;
  }

  if (String(tweet.in_reply_to_user_id || '') === String(user.id)) {
    return true;
  }

  if (!tweet.in_reply_to_user_id && replyTargetIds(tweet).some((id) => ownTweetIds.has(id))) {
    return true;
  }

  return false;
}

function expandedLinks(tweet) {
  const urls = tweet.entities && Array.isArray(tweet.entities.urls) ? tweet.entities.urls : [];

  return urls
    .map((url) => url.expanded_url || url.unwound_url || url.url)
    .filter(Boolean);
}

function tweetText(tweet) {
  return cleanText((tweet.note_tweet && tweet.note_tweet.text) || tweet.text || '');
}

function normalizeTweet(tweet, user, account, mediaByKey) {
  const media = normalizeMedia(tweet, mediaByKey);
  const publicMetrics = tweet.public_metrics || {};

  return {
    id: `${account.username || user.username}-${tweet.id}`,
    username: user.username || account.username,
    displayName: user.name || account.displayName || account.username,
    avatar: user.profile_image_url || account.avatar || '',
    verified: Boolean(user.verified || account.verified),
    text: tweetText(tweet),
    createdAt: tweet.created_at,
    created_at: tweet.created_at,
    url: `https://x.com/${user.username || account.username}/status/${tweet.id}`,
    post_url: `https://x.com/${user.username || account.username}/status/${tweet.id}`,
    images: media.images,
    video: media.video,
    video_preview: media.videoPreview,
    videoPreview: media.videoPreview,
    conversation_id: tweet.conversation_id || '',
    in_reply_to_user_id: tweet.in_reply_to_user_id || '',
    referenced_tweets: Array.isArray(tweet.referenced_tweets) ? tweet.referenced_tweets : [],
    likes: publicMetrics.like_count || 0,
    replies: publicMetrics.reply_count || 0,
    reposts: publicMetrics.retweet_count || 0,
    category: account.category,
    network: account.network,
    partner: account.partner,
    partnerName: account.partnerName,
    priority: account.priority,
    external_links: expandedLinks(tweet),
    source: 'xapi'
  };
}

async function fetchAccountPosts(account, options = {}) {
  const config = getConfig(options.config || {});
  const token = getBearerToken();

  if (!token) {
    throw new Error('X API bearer token is missing. Set X_BEARER_TOKEN in .env.local or GitHub Secrets.');
  }

  const user = await getUserByUsername(account.username, config, token);
  const posts = [];
  let paginationToken = '';

  for (let page = 0; page < config.maxPages; page += 1) {
    const params = {
      max_results: config.maxResults,
      exclude: 'retweets',
      'tweet.fields': config.tweetFields,
      expansions: config.expansions,
      'media.fields': config.mediaFields,
      pagination_token: paginationToken
    };

    if (options.sinceId) {
      params.since_id = options.sinceId;
    } else if (account.minCreatedAt) {
      params.start_time = toXDateTime(account.minCreatedAt);
    }

    const url = buildUrl(config.baseUrl, `/users/${encodeURIComponent(user.id)}/tweets`, params);
    const payload = await fetchJson(url, token, config.timeoutMs);
    const mediaByKey = new Map(
      ((payload.includes && payload.includes.media) || []).map((media) => [media.media_key, media])
    );
    const tweets = payload.data || [];
    const ownTweetIds = new Set(tweets.map((tweet) => String(tweet.id)));
    const pagePosts = tweets
      .filter((tweet) => isOwnThreadReply(tweet, user, ownTweetIds))
      .map((tweet) => normalizeTweet(tweet, user, account, mediaByKey));

    posts.push(...pagePosts);

    paginationToken = payload.meta && payload.meta.next_token ? payload.meta.next_token : '';

    if (!paginationToken) {
      break;
    }
  }

  return {
    posts,
    diagnostics: {
      apiStatus: 'online',
      pagesRequested: Math.max(1, posts.length ? Math.ceil(posts.length / config.maxResults) : 1)
    }
  };
}

module.exports = {
  fetchAccountPosts
};
