(function (global) {
  const postLimit = 280;
  const attributionText = 'Generated with https://0xb20.lol/ai';

  function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function assemblePost(payload, options) {
    const source = payload || {};
    const base = source.post || source.signal || source.text || '';
    const emojis = options && options.emojis ? toArray(source.emojis).slice(0, 5) : [];
    const hashtags = options && options.hashtags ? toArray(source.hashtags).slice(0, 5) : [];
    const parts = [`${base.trim()}${emojis.length ? ` ${emojis.join(' ')}` : ''}`.trim()];

    if (hashtags.length) {
      parts.push(hashtags.join(' '));
    }

    if (options && options.attribution) {
      parts.push(attributionText);
    }

    return parts.filter(Boolean).join('\n\n');
  }

  function formatPayload(payload) {
    const source = payload || {};

    if (source.summary || source.post || (Array.isArray(source.bullets) && source.bullets.length) || (Array.isArray(source.notes) && source.notes.length)) {
      const sections = [];

      if (source.summary) {
        sections.push(`SUMMARY\n${source.summary}`);
      }

      if (source.post) {
        sections.push(`X POST\n${source.post}`);
      }

      if (Array.isArray(source.items) && source.items.length) {
        sections.push(`THREAD\n${source.items.join('\n\n')}`);
      }

      if (Array.isArray(source.bullets) && source.bullets.length) {
        sections.push(`BULLETS\n${source.bullets.map((item) => `• ${item}`).join('\n')}`);
      }

      if (Array.isArray(source.notes) && source.notes.length) {
        sections.push(`BUILDER NOTES\n${source.notes.map((item) => `• ${item}`).join('\n')}`);
      }

      return sections.join('\n\n---\n\n');
    }

    if (Array.isArray(source.items) && source.items.length) {
      return source.items.join('\n\n');
    }

    if (source.campaign && typeof source.campaign === 'object') {
      return Object.entries(source.campaign)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key.toUpperCase()}\n${value.join('\n\n')}`;
          }
          return `${key.toUpperCase()}\n${value}`;
        })
        .join('\n\n---\n\n');
    }

    if (Array.isArray(source.hashtags) && source.hashtags.length && !source.post && !source.signal) {
      return source.hashtags.join(' ');
    }

    return source.signal || source.post || source.summary || source.text || '';
  }

  function countWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function analyze(text) {
    const value = String(text || '').trim();
    const words = countWords(value);
    const lines = value ? value.split(/\n+/).length : 0;
    const hashtags = (value.match(/#[\p{L}\p{N}_]+/gu) || []).length;
    const mentions = (value.match(/(^|\s)@[\w_]+/g) || []).length;
    const characterCount = value.length;
    const readability = characterCount <= 280 && words <= 55 ? 'High' : characterCount <= 700 ? 'Medium' : 'Dense';
    const builderScore = Math.min(100, Math.max(12, 42 + (/\b(build|ship|builder|launch|research|code|tool|product|Base)\b/i.test(value) ? 28 : 0) + Math.min(30, Math.floor(words / 2))));
    const engagementScore = Math.min(100, Math.max(10, 35 + (lines > 1 ? 12 : 0) + (hashtags ? 8 : 0) + (mentions ? 8 : 0) + (/[?!]/.test(value) ? 6 : 0)));
    const virality = Math.min(100, Math.max(8, Math.round((engagementScore + builderScore) / 2) - (words > 90 ? 18 : 0)));

    return {
      readability,
      engagementScore,
      builderScore,
      virality,
      length: characterCount,
      characterCount,
      hashtags,
      mentions
    };
  }

  function tweetIntent(text) {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text || '')}`;
  }

  global.B20AiPreview = {
    postLimit,
    assemblePost,
    formatPayload,
    analyze,
    tweetIntent
  };
})(window);
