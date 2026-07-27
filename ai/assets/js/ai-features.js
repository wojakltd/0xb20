(function (global) {
  const modes = [
    { id: 'signal', label: 'Signal Generator', action: 'generateSignal', premium: null, placeholder: 'What are you thinking about?' },
    { id: 'thread', label: 'Thread Generator', action: 'generateThread', premium: ['aiLabThreadGenerator', 'Thread Generator'], placeholder: 'Topic, launch, update, or idea for the thread' },
    { id: 'replies', label: 'Reply Generator', action: 'generateReplies', premium: null, placeholder: 'Paste a tweet, post text, or tweet URL' },
    { id: 'quote', label: 'Quote Generator', action: 'generateQuote', premium: null, placeholder: 'Paste the post you want to quote' },
    { id: 'campaign', label: 'Campaign Generator', action: 'generateCampaign', premium: ['aiLabCampaignGenerator', 'Campaign Generator'], placeholder: 'Example: Launch Wallet Parser' },
    { id: 'summary', label: 'Research Summary', action: 'summarizeResearch', premium: ['aiLabResearchSummary', 'Advanced Research Summary'], placeholder: 'Paste article, thread, long post, or notes' },
    { id: 'hashtags', label: 'Hashtag Generator', action: 'generateHashtags', premium: null, placeholder: 'Topic or post that needs hashtags' }
  ];

  const styles = [
    'builder',
    'minimal',
    'professional',
    'technical',
    'funny',
    'bullish',
    'neutral',
    'meme',
    'founder',
    'visionary',
    'random'
  ];

  const languages = [
    ['auto', 'Auto Detect'],
    ['en', 'English'],
    ['ru', 'Русский'],
    ['zh', '中文'],
    ['ja', '日本語'],
    ['es', 'Español'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['pt', 'Português'],
    ['it', 'Italiano'],
    ['tr', 'Türkçe'],
    ['id', 'Bahasa Indonesia'],
    ['vi', 'Tiếng Việt'],
    ['ar', 'العربية'],
    ['hi', 'हिन्दी'],
    ['ko', '한국어']
  ];

  const agents = [
    ['builder', 'Builder AI'],
    ['marketing', 'Marketing AI'],
    ['research', 'Research AI'],
    ['growth', 'Growth AI'],
    ['launch', 'Launch AI'],
    ['meme', 'Meme AI']
  ];

  const defaultPersonas = [
    { id: 'default', name: 'Laboratory', guidance: 'Independent researcher. Minimal, direct, no hype.' },
    { id: 'brian', name: 'Brian', guidance: 'Operator tone. Clear, pragmatic, product-focused, calm.' },
    { id: 'jesse', name: 'Jesse', guidance: 'Base builder energy. Public goods, onchain builders, optimistic but not cringe.' },
    { id: 'vitalik', name: 'Vitalik', guidance: 'Technical, thoughtful, nuanced, avoids slogans.' },
    { id: 'professional', name: 'Professional', guidance: 'Clean, credible, product-oriented, investor-readable.' },
    { id: 'builder', name: 'Builder', guidance: 'Build-first voice. Iteration, shipping, practical lessons.' },
    { id: 'founder', name: 'Founder', guidance: 'Founder notes. Honest constraints, decisions, public building.' },
    { id: 'minimal', name: 'Minimal', guidance: 'Few words. Sharp edges. No decoration.' },
    { id: 'meme', name: 'Meme', guidance: 'Funny crypto-native observation, but never spammy.' }
  ];

  const promptLibrary = {
    Launch: [
      'Launch a new Web3 tool and explain why it matters.',
      'Announce a public product release without hype.',
      'Write a launch post for a useful Base experiment.'
    ],
    Builder: [
      'Builders who keep shipping while everyone waits.',
      'Small teams building public infrastructure.',
      'Why iteration beats perfect planning.'
    ],
    Announcement: [
      'Announce a new update from the Laboratory.',
      'Explain a product change in a clear public post.',
      'Turn a technical update into a readable X post.'
    ],
    Thread: [
      'Explain a product launch as a short thread.',
      'Turn a project milestone into a 4-part thread.',
      'Write a thread about building in public.'
    ],
    Partnership: [
      'Announce a partnership without sounding corporate.',
      'Explain why collaboration matters in Web3.',
      'Write a partner-facing ecosystem note.'
    ],
    Airdrop: [
      'Write a clean airdrop announcement without farm bait.',
      'Explain why rewards should follow utility.',
      'Create a reminder for a holder distribution.'
    ],
    Token: [
      'Explain a token as an experiment, not a promise.',
      'Write about holders as participants.',
      'Create a token update with no price talk.'
    ],
    Community: [
      'Thank early users without sounding generic.',
      'Write a community update for builders.',
      'Explain why trust compounds slowly.'
    ],
    Research: [
      'Summarize market behavior as a Laboratory observation.',
      'Explain a Base ecosystem signal.',
      'Turn a research note into a concise post.'
    ],
    AI: [
      'Explain AI as a tool for builders.',
      'Write about AI content without sounding automated.',
      'Create an AI Lab launch signal.'
    ],
    Base: [
      'Write about Base builders shipping products.',
      'Explain why Base is useful for experiments.',
      'Create a Base ecosystem observation.'
    ],
    Coinbase: [
      'Write a Coinbase ecosystem observation.',
      'Explain consumer crypto without generic slogans.',
      'Create a credible builder note about onchain adoption.'
    ],
    Meme: [
      'Write a funny crypto observation with no moon language.',
      'Turn memecoin chaos into a useful builder insight.',
      'Write a meme-style post that still feels intelligent.'
    ],
    Favorites: []
  };

  function byId(collection, id) {
    return collection.find((item) => item.id === id) || collection[0];
  }

  function normalizeMode(value) {
    return byId(modes, value || 'signal').id;
  }

  function normalizeStyle(value) {
    return styles.includes(value) ? value : 'builder';
  }

  function normalizeLanguage(value) {
    return languages.some(([id]) => id === value) ? value : 'auto';
  }

  function normalizeAgent(value) {
    return agents.some(([id]) => id === value) ? value : 'builder';
  }

  function resolveStyle(style) {
    if (style !== 'random') {
      return style;
    }

    const pool = styles.filter((item) => item !== 'random');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  global.B20AiFeatures = {
    modes,
    styles,
    languages,
    agents,
    defaultPersonas,
    promptLibrary,
    byId,
    normalizeMode,
    normalizeStyle,
    normalizeLanguage,
    normalizeAgent,
    resolveStyle
  };
})(window);
