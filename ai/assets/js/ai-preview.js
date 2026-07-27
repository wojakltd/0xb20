(function (global) {
  const postLimit = 280;
  const attributionText = 'Generated with https://0xb20.lol/ai';

  function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function cleanText(value) {
    return String(value || '').trim();
  }

  function assemblePost(payload, options) {
    const source = payload || {};
    const base = cleanText(source.post || source.signal || source.text || '');
    const emojis = options && options.emojis ? toArray(source.emojis).slice(0, 5) : [];
    const hashtags = options && options.hashtags ? toArray(source.hashtags).slice(0, 5) : [];
    const parts = [`${base}${emojis.length ? ` ${emojis.join(' ')}` : ''}`.trim()];

    if (hashtags.length) {
      parts.push(hashtags.join(' '));
    }

    if (options && options.attribution) {
      parts.push(attributionText);
    }

    return parts.filter(Boolean).join('\n\n');
  }

  function campaignEntries(campaign) {
    const source = campaign && typeof campaign === 'object' ? campaign : {};
    return [
      ['launchPost', 'Launch', source.launchPost],
      ['launchThread', 'Thread', source.launchThread],
      ['replies', 'Replies', source.replies],
      ['quoteTweet', 'Quote', source.quoteTweet],
      ['followUp', 'Follow-up', source.followUp],
      ['reminder', 'Reminder', source.reminder],
      ['lastChance', 'Last Chance', source.lastChance],
      ['finalUpdate', 'Final Update', source.finalUpdate]
    ].filter(([, , value]) => Array.isArray(value) ? value.length : cleanText(value));
  }

  function formatCampaign(campaign) {
    return campaignEntries(campaign)
      .map(([, label, value]) => {
        const body = Array.isArray(value) ? value.join('\n\n') : value;
        return `${label.toUpperCase()}\n${body}`;
      })
      .join('\n\n---\n\n');
  }

  function formatPayload(payload, mode) {
    const source = payload || {};
    const resolvedMode = mode || source.mode || '';

    if (resolvedMode === 'campaign' || source.campaign) {
      return formatCampaign(source.campaign);
    }

    if (resolvedMode === 'thread' || resolvedMode === 'replies') {
      return toArray(source.items).join('\n\n');
    }

    if (resolvedMode === 'summary') {
      const sections = [];

      if (source.summary) {
        sections.push(`SUMMARY\n${source.summary}`);
      }

      if (source.post) {
        sections.push(`X POST\n${source.post}`);
      }

      if (toArray(source.items).length) {
        sections.push(`THREAD\n${toArray(source.items).join('\n\n')}`);
      }

      if (toArray(source.bullets).length) {
        sections.push(`BULLETS\n${toArray(source.bullets).map((item) => `• ${item}`).join('\n')}`);
      }

      if (toArray(source.notes).length) {
        sections.push(`BUILDER NOTES\n${toArray(source.notes).map((item) => `• ${item}`).join('\n')}`);
      }

      return sections.join('\n\n---\n\n');
    }

    if (resolvedMode === 'hashtags') {
      return toArray(source.hashtags).join(' ');
    }

    return cleanText(source.signal || source.post || source.summary || source.text || '');
  }

  function countWords(text) {
    return cleanText(text).split(/\s+/).filter(Boolean).length;
  }

  function analyze(text) {
    const value = cleanText(text);
    const words = countWords(value);
    const lines = value ? value.split(/\n+/).length : 0;
    const hashtags = (value.match(/#[\p{L}\p{N}_]+/gu) || []).length;
    const mentions = (value.match(/(^|\s)@[\w_]+/g) || []).length;
    const emojis = (value.match(/\p{Extended_Pictographic}/gu) || []).length;
    const questions = (value.match(/\?/g) || []).length;
    const hasCta = /\b(open|try|build|read|join|follow|ship|launch|use|test|start|explore|copy|share|подключ|попроб|читай|строй)\b/i.test(value);
    const hasBuilderLanguage = /\b(build|ship|builder|launch|research|code|tool|product|protocol|Base|wallet|parser|sender|стро|код|инструмент|исслед)\b/i.test(value);
    const sentenceCount = Math.max(1, value.split(/[.!?。！？]+/).filter((item) => item.trim()).length);
    const avgWords = words / sentenceCount;
    const characterCount = value.length;
    const readabilityScore = Math.max(0, Math.min(100, 96 - Math.max(0, avgWords - 14) * 3 - Math.max(0, words - 70)));
    const professionalism = Math.max(0, Math.min(100, 76 - emojis * 5 - Math.max(0, hashtags - 4) * 4 + (hasCta ? 4 : 0)));
    const builderScore = Math.max(0, Math.min(100, 44 + (hasBuilderLanguage ? 32 : 0) + (hasCta ? 8 : 0) + Math.min(16, Math.floor(words / 5))));
    const engagementScore = Math.max(0, Math.min(100, 34 + lines * 3 + questions * 8 + hashtags * 4 + mentions * 5 + emojis * 3 + (hasCta ? 10 : 0)));
    const virality = Math.max(0, Math.min(100, Math.round((engagementScore + builderScore) / 2) + (words < 32 ? 8 : 0) - Math.max(0, hashtags - 5) * 5));

    return {
      readability: readabilityScore >= 78 ? 'High' : readabilityScore >= 54 ? 'Medium' : 'Dense',
      readabilityScore,
      engagementScore,
      builderScore,
      virality,
      professionalism,
      estimatedEngagement: engagementScore >= 70 ? 'Strong' : engagementScore >= 45 ? 'Moderate' : 'Quiet',
      length: characterCount,
      characterCount,
      words,
      hashtags,
      mentions,
      emojiDensity: words ? Math.round((emojis / words) * 100) : 0,
      ctaDetected: hasCta,
      questionDetected: questions > 0
    };
  }

  function tweetIntent(text) {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text || '')}`;
  }

  function isMeaningfullyDifferent(before, after) {
    const left = cleanText(before).toLowerCase();
    const right = cleanText(after).toLowerCase();

    if (!left || !right || left === right) {
      return false;
    }

    const leftWords = new Set(left.split(/\W+/).filter(Boolean));
    const rightWords = right.split(/\W+/).filter(Boolean);
    const shared = rightWords.filter((word) => leftWords.has(word)).length;
    const ratio = rightWords.length ? shared / rightWords.length : 1;

    return ratio < 0.82 || Math.abs(left.length - right.length) > 18;
  }

  global.B20AiPreview = {
    postLimit,
    assemblePost,
    campaignEntries,
    formatCampaign,
    formatPayload,
    analyze,
    tweetIntent,
    isMeaningfullyDifferent
  };
})(window);
