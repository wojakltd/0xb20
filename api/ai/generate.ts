type VercelRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string;
  };
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type Action =
  | 'generateSignal'
  | 'generatePost'
  | 'remixSignal'
  | 'remixContent'
  | 'generateThread'
  | 'generateReplies'
  | 'generateQuote'
  | 'generateCampaign'
  | 'summarizeResearch'
  | 'generateHashtags';

type GenerateBody = {
  action?: unknown;
  topic?: unknown;
  signal?: unknown;
  style?: unknown;
  language?: unknown;
  count?: unknown;
  agent?: unknown;
  memory?: unknown;
  persona?: unknown;
  remixMode?: unknown;
  options?: unknown;
};

type PostOptions = {
  emojis: boolean;
  hashtags: boolean;
  attribution: boolean;
};

type AiPayload = {
  signal?: string;
  post?: string;
  items?: string[];
  campaign?: Record<string, string | string[]>;
  summary?: string;
  bullets?: string[];
  notes?: string[];
  hashtags?: string[];
  emojis?: string[];
  characterCount?: number;
};

type RateEntry = {
  count: number;
  resetAt: number;
};

const allowedActions = new Set<Action>([
  'generateSignal',
  'generatePost',
  'remixSignal',
  'remixContent',
  'generateThread',
  'generateReplies',
  'generateQuote',
  'generateCampaign',
  'summarizeResearch',
  'generateHashtags'
]);
const allowedStyles = new Set([
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
  'random',
  'philosophy',
  'brutal'
]);
const allowedAgents = new Set(['builder', 'marketing', 'research', 'growth', 'launch', 'meme']);
const outputLanguages: Record<string, string> = {
  auto: 'Auto. Detect the user input language and write naturally in that language. If the language is unclear, use English.',
  en: 'English. Write naturally in English.',
  ru: 'Russian. Write naturally in Russian.',
  es: 'Spanish. Write naturally in Spanish.',
  pt: 'Portuguese. Write naturally in Portuguese.',
  fr: 'French. Write naturally in French.',
  de: 'German. Write naturally in German.',
  it: 'Italian. Write naturally in Italian.',
  tr: 'Turkish. Write naturally in Turkish.',
  id: 'Indonesian. Write naturally in Indonesian.',
  vi: 'Vietnamese. Write naturally in Vietnamese.',
  ar: 'Arabic. Write naturally in Arabic.',
  hi: 'Hindi. Write naturally in Hindi.',
  zh: 'Simplified Chinese. Write naturally in Simplified Chinese.',
  ja: 'Japanese. Write naturally in Japanese.',
  ko: 'Korean. Write naturally in Korean.'
};
const fallbackModel = 'gpt-4.1-mini';
const maxTopicLength = 2400;
const maxSignalLength = 2200;
const maxContextLength = 1200;
const maxRequestBytes = 12000;
const rateWindowMs = 60 * 1000;
const dailyWindowMs = 24 * 60 * 60 * 1000;
const defaultMinuteLimit = 20;
const defaultDailyLimit = 300;
const maxRateEntries = 1000;
const openAiTimeoutMs = 18 * 1000;
const attributionText = 'Generated with https://0xb20.lol/ai';
const minuteRate = new Map<string, RateEntry>();
const dailyRate = new Map<string, RateEntry>();

function readHeader(req: VercelRequest, name: string): string {
  const headers = req.headers || {};
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;

  return typeof value === 'string' ? value : '';
}

function readNumberEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function isAllowedOrigin(value: string): boolean {
  if (!value) {
    return true;
  }

  try {
    const host = new URL(value).hostname.toLowerCase();

    return host === '0xb20.lol'
      || host === 'www.0xb20.lol'
      || host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.vercel.app');
  } catch (error) {
    return false;
  }
}

function clientKey(req: VercelRequest): string {
  const forwarded = readHeader(req, 'x-forwarded-for').split(',')[0].trim();
  const realIp = readHeader(req, 'x-real-ip').trim();
  const vercelIp = readHeader(req, 'x-vercel-forwarded-for').split(',')[0].trim();

  return forwarded || realIp || vercelIp || req.socket?.remoteAddress || 'unknown';
}

function pruneRateMap(map: Map<string, RateEntry>, now: number) {
  if (map.size <= maxRateEntries) {
    return;
  }

  for (const [key, entry] of map.entries()) {
    if (entry.resetAt <= now) {
      map.delete(key);
    }
  }
}

function consumeRate(map: Map<string, RateEntry>, key: string, limit: number, windowMs: number, now: number) {
  pruneRateMap(map, now);

  const current = map.get(key);

  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function requestSizeBytes(body: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(body || {})).length;
  } catch (error) {
    return maxRequestBytes + 1;
  }
}

function enforceRequestProtection(req: VercelRequest, res: VercelResponse): boolean {
  const origin = readHeader(req, 'origin');

  if (!isAllowedOrigin(origin)) {
    res.status(403).json({ error: 'Laboratory origin rejected.' });
    return false;
  }

  const contentLength = Number(readHeader(req, 'content-length'));

  if ((Number.isFinite(contentLength) && contentLength > maxRequestBytes) || requestSizeBytes(req.body) > maxRequestBytes) {
    res.status(413).json({ error: 'Signal payload too large.' });
    return false;
  }

  const now = Date.now();
  const key = clientKey(req);
  const minuteLimit = readNumberEnv('AI_RATE_LIMIT_PER_MINUTE', defaultMinuteLimit, 1, 60);
  const dailyLimit = readNumberEnv('AI_RATE_LIMIT_PER_DAY', defaultDailyLimit, 10, 1000);
  const minute = consumeRate(minuteRate, key, minuteLimit, rateWindowMs, now);

  if (!minute.allowed) {
    res.setHeader('Retry-After', String(minute.retryAfter));
    res.status(429).json({ error: `Synthesis queue saturated. Retry in ${minute.retryAfter}s.` });
    return false;
  }

  const daily = consumeRate(dailyRate, key, dailyLimit, dailyWindowMs, now);

  if (!daily.allowed) {
    res.setHeader('Retry-After', String(daily.retryAfter));
    res.status(429).json({ error: 'Daily synthesis budget reached. Research resumes later.' });
    return false;
  }

  return true;
}

function normalizeBody(body: unknown): GenerateBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as GenerateBody;
    } catch (error) {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as GenerateBody;
  }

  return {};
}

function normalizeAction(action: unknown): Action {
  if (typeof action !== 'string') {
    return 'generateSignal';
  }

  const normalized = action.trim() as Action;
  return allowedActions.has(normalized) ? normalized : 'generateSignal';
}

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .slice(0, maxLength);
}

function normalizeInlineText(value: unknown, maxLength: number): string {
  return normalizeText(value, maxLength)
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStyle(style: unknown): string {
  if (typeof style !== 'string') {
    return 'builder';
  }

  const normalized = style.trim().toLowerCase();
  return allowedStyles.has(normalized) ? normalized : 'builder';
}

function normalizeLanguage(language: unknown): string {
  if (typeof language !== 'string') {
    return 'auto';
  }

  const normalized = language.trim().toLowerCase();
  return outputLanguages[normalized] ? normalized : 'auto';
}

function normalizeAgent(agent: unknown): string {
  if (typeof agent !== 'string') {
    return 'builder';
  }

  const normalized = agent.trim().toLowerCase();
  return allowedAgents.has(normalized) ? normalized : 'builder';
}

function normalizeCount(action: Action, count: unknown): number {
  const value = Number(count);

  if (action === 'generateThread') {
    const allowed = [2, 4, 8, 12];
    return allowed.includes(value) ? value : 4;
  }

  if (action === 'generateReplies' || action === 'generateHashtags') {
    const allowed = [5, 10, 20];
    return allowed.includes(value) ? value : 5;
  }

  return Math.min(20, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 4));
}

function normalizeRecord(value: unknown, maxEntries: number): Record<string, string> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const output: Record<string, string> = {};

  for (const [key, field] of Object.entries(source).slice(0, maxEntries)) {
    if (typeof field !== 'string') {
      continue;
    }

    const normalizedKey = key.replace(/[^\w-]/g, '').slice(0, 32);
    const normalizedValue = normalizeInlineText(field, 220);

    if (normalizedKey && normalizedValue) {
      output[normalizedKey] = normalizedValue;
    }
  }

  return output;
}

function normalizeOptions(options: unknown): PostOptions {
  const source = options && typeof options === 'object' ? options as Record<string, unknown> : {};

  return {
    emojis: source.emojis === true,
    hashtags: source.hashtags === true,
    attribution: source.attribution === true
  };
}

function languageInstruction(language: string): string {
  return `output language: ${outputLanguages[normalizeLanguage(language)]}`;
}

function getOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') {
    return payload.output_text;
  }

  const chunks: string[] = [];

  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

function parseJsonOutput(text: string): AiPayload {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return {};
    }

    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch (nestedError) {
      return {};
    }
  }
}

function uniqueStrings(values: unknown, maxCount: number): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();

    if (!trimmed || seen.has(trimmed.toLowerCase())) {
      continue;
    }

    seen.add(trimmed.toLowerCase());
    normalized.push(trimmed);

    if (normalized.length >= maxCount) {
      break;
    }
  }

  return normalized;
}

function normalizeHashtags(values: unknown, maxCount = 5): string[] {
  return uniqueStrings(values, maxCount)
    .map((tag) => tag.replace(/\s+/g, '').replace(/^#?/, '#'))
    .filter((tag) => /^#[\p{L}\p{N}_]{2,40}$/u.test(tag));
}

function normalizeEmojis(values: unknown): string[] {
  return uniqueStrings(values, 5).filter((emoji) => emoji.length <= 12);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeSignal(value: unknown): string {
  let signal = normalizeInlineText(value, 420);

  if (!signal) {
    return '';
  }

  const sentences = splitSentences(signal).slice(0, 2);

  if (sentences.length) {
    signal = sentences.join(' ');
  }

  const words = signal.split(/\s+/).filter(Boolean);

  if (words.length > 35) {
    signal = words.slice(0, 35).join(' ');
  }

  return signal.replace(/\s+([,.!?;:])/g, '$1').trim();
}

function normalizePost(value: unknown, maxLength = 520): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]+/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.!?;:])/g, '$1')
    .slice(0, maxLength)
    .trim();
}

function normalizeItems(values: unknown, maxCount: number, maxLength: number): string[] {
  return uniqueStrings(values, maxCount)
    .map((item) => normalizePost(item, maxLength))
    .filter(Boolean);
}

function normalizeCampaign(value: unknown): Record<string, string | string[]> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const keys = ['launchPost', 'launchThread', 'replies', 'quoteTweet', 'followUp', 'reminder', 'lastChance', 'finalUpdate'];
  const output: Record<string, string | string[]> = {};

  keys.forEach((key) => {
    const entry = source[key];
    if (Array.isArray(entry)) {
      const items = normalizeItems(entry, key === 'replies' ? 5 : 12, 300);
      if (items.length) {
        output[key] = items;
      }
      return;
    }

    const text = normalizePost(entry, 360);
    if (text) {
      output[key] = text;
    }
  });

  return output;
}

function assemblePost(post: string, hashtags: string[], emojis: string[], options: PostOptions): string {
  const emojiSuffix = options.emojis && emojis.length ? ` ${emojis.join(' ')}` : '';
  const parts = [`${post.trim()}${emojiSuffix}`.trim()];

  if (options.hashtags && hashtags.length) {
    parts.push(hashtags.join(' '));
  }

  if (options.attribution) {
    parts.push(attributionText);
  }

  return parts.filter(Boolean).join('\n\n');
}

function formatMemory(memory: Record<string, string>): string {
  const entries = Object.entries(memory)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);

  return entries.length ? entries.join('\n') : 'none';
}

function personaInstruction(persona: Record<string, string>): string {
  const name = persona.name || 'Laboratory';
  const guidance = persona.guidance || 'Independent researcher. Minimal, direct, no hype.';
  return `persona: ${name}\npersona guidance: ${guidance}`;
}

function agentInstruction(agent: string): string {
  const map: Record<string, string> = {
    builder: 'Builder AI: practical, product-first, shipping-focused.',
    marketing: 'Marketing AI: clear growth communication without hype.',
    research: 'Research AI: precise, analytical, signal over noise.',
    growth: 'Growth AI: distribution-aware, concise, conversion-oriented.',
    launch: 'Launch AI: launch sequencing, CTA discipline, public release clarity.',
    meme: 'Meme AI: crypto-native humor, sharp but not spammy.'
  };

  return map[normalizeAgent(agent)] || map.builder;
}

function buildJsonShape(action: Action): string {
  if (action === 'generatePost' || action === 'generateQuote' || action === 'remixContent' || action === 'remixSignal') {
    return '{"signal":"","post":"...","hashtags":["#Base"],"emojis":["🧪"],"characterCount":0}';
  }

  if (action === 'generateThread' || action === 'generateReplies') {
    return '{"items":["..."],"post":"","hashtags":["#Base"],"emojis":["🧪"],"characterCount":0}';
  }

  if (action === 'generateCampaign') {
    return '{"campaign":{"launchPost":"...","launchThread":["1/4 ..."],"replies":["..."],"quoteTweet":"...","followUp":"...","reminder":"...","lastChance":"...","finalUpdate":"..."},"hashtags":["#Base"],"emojis":["🧪"],"characterCount":0}';
  }

  if (action === 'summarizeResearch') {
    return '{"summary":"...","post":"...","items":["1/4 ..."],"bullets":["..."],"notes":["..."],"hashtags":["#Base"],"emojis":["🧪"],"characterCount":0}';
  }

  if (action === 'generateHashtags') {
    return '{"hashtags":["#Base"],"signal":"","post":"","emojis":[],"characterCount":0}';
  }

  return '{"signal":"...","post":"","hashtags":["#Base"],"emojis":["🧪"],"characterCount":0}';
}

function buildSystemPrompt(action: Action, agent: string, persona: Record<string, string>): string {
  const base = [
    'You are the 0XB20 Laboratory AI Growth engine.',
    'Act as an experienced independent researcher, minimalist writer, builder, and crypto observer.',
    'Write natively in the requested output language; never translate literally.',
    'No hype, moon language, price predictions, financial advice, fake confidence, roleplay, greetings, explanations, famous quotes, LinkedIn tone, influencer language, or "As an AI".',
    'Never mention being an AI.',
    'Return valid JSON only.',
    agentInstruction(agent),
    personaInstruction(persona)
  ].join(' ');

  if (action === 'generatePost') {
    return `${base} Generate one shareable X transmission from the provided source. Return emojis as subtle ending accents only; do not place emojis randomly. Return hashtags only as an array.`;
  }

  if (action === 'generateThread') {
    return `${base} Generate compact X thread items with natural progression. Number every item. Final item must include a concise CTA.`;
  }

  if (action === 'generateReplies') {
    return `${base} Generate distinct replies. They must feel human, useful, and non-spammy.`;
  }

  if (action === 'generateCampaign') {
    return `${base} Generate a compact release campaign with launch post, thread, replies, quote tweet, follow-up, reminder, last chance, and final update.`;
  }

  if (action === 'summarizeResearch') {
    return `${base} Summarize source material into practical builder-facing X content and notes.`;
  }

  if (action === 'generateHashtags') {
    return `${base} Generate only highly relevant hashtags. No generic spam tags.`;
  }

  if (action === 'remixContent' || action === 'remixSignal') {
    return `${base} Remix the provided content into a genuinely different angle, structure, and perspective. Do not perform synonym replacement.`;
  }

  return `${base} Generate one memorable screenshot-worthy signal.`;
}

function buildUserPrompt(
  action: Action,
  topic: string,
  signal: string,
  style: string,
  language: string,
  count: number,
  memory: Record<string, string>,
  persona: Record<string, string>,
  agent: string,
  remixMode: string,
  options: PostOptions
): string {
  const context = [
    languageInstruction(language),
    `style: ${style}`,
    `agent: ${agent}`,
    `project memory:\n${formatMemory(memory)}`,
    personaInstruction(persona)
  ].join('\n');

  if (action === 'generatePost') {
    const maxBaseLength = options.attribution || options.hashtags || options.emojis ? 175 : 220;

    return [
      context,
      `source content: ${signal}`,
      `topic context for relevance only: ${topic || 'none'}`,
      `base post max characters: ${maxBaseLength}`,
      'Write one original X post based only on the source content.',
      'No thread, no essay, no greeting, no generic crypto slogan.',
      'Return 0-3 intelligent emojis if they truly fit. Return 0-5 highly relevant hashtags.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'generateThread') {
    return [
      context,
      `topic: ${topic}`,
      `thread length: exactly ${count} posts`,
      'Each item must fit X. Number every post like 1/4, 2/4.',
      'Build a clear progression: hook, context, insight, CTA.',
      'No filler. No hype. No promises.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'generateReplies') {
    return [
      context,
      `tweet or URL: ${topic}`,
      `reply count: exactly ${count}`,
      'Generate distinct replies with different angles.',
      'Replies must not look copied, spammy, or automated.',
      'Use the requested style category.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'generateQuote') {
    return [
      context,
      `post to quote: ${topic}`,
      'Generate one quote tweet. Add a fresh angle, not a summary.',
      'Maximum 230 characters before optional hashtags/emojis.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'generateCampaign') {
    return [
      context,
      `campaign objective: ${topic}`,
      'Generate: launch post, 4-post launch thread, 3 replies, quote tweet, follow-up, reminder, last chance, final update.',
      'Every item must be concise and X-ready.',
      'No fake urgency unless the topic explicitly includes a real deadline.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'summarizeResearch') {
    return [
      context,
      `source material:\n${topic}`,
      'Return a concise summary, one X post, a 4-post thread, 5 bullet points, and 5 builder notes.',
      'Preserve facts. Do not invent claims.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'generateHashtags') {
    return [
      context,
      `topic or post: ${topic}`,
      `hashtag count: exactly ${count}`,
      'Generate highly relevant hashtags only. No generic spam. No duplicates.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'remixContent' || action === 'remixSignal') {
    return [
      context,
      `current content: ${signal}`,
      `topic context: ${topic || 'none'}`,
      `remix direction: ${remixMode || 'different angle'}`,
      'Create a new version with different wording, structure, and perspective.',
      'Keep it concise. No explanation.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  return [
    context,
    `topic: ${topic}`,
    'Create one signal only.',
    'Maximum 35 words. Maximum two short sentences. Shorter is better.',
    'It must feel memorable, concrete, and screenshot-worthy.',
    'No paragraph, no explanation, no thread, no fake wisdom.',
    `JSON shape: ${buildJsonShape(action)}`
  ].join('\n');
}

function buildPrompt(
  action: Action,
  topic: string,
  signal: string,
  style: string,
  language: string,
  count: number,
  memory: Record<string, string>,
  persona: Record<string, string>,
  agent: string,
  remixMode: string,
  options: PostOptions
) {
  return [
    {
      role: 'system',
      content: buildSystemPrompt(action, agent, persona)
    },
    {
      role: 'user',
      content: buildUserPrompt(action, topic, signal, style, language, count, memory, persona, agent, remixMode, options)
    }
  ];
}

function maxOutputTokensFor(action: Action): number {
  const map: Record<Action, number> = {
    generateSignal: 150,
    generatePost: 230,
    remixSignal: 230,
    remixContent: 300,
    generateThread: 900,
    generateReplies: 900,
    generateQuote: 230,
    generateCampaign: 1300,
    summarizeResearch: 1000,
    generateHashtags: 180
  };

  return map[action] || 300;
}

function temperatureFor(action: Action): number {
  if (action === 'generateHashtags' || action === 'summarizeResearch') {
    return 0.55;
  }

  if (action === 'remixContent' || action === 'remixSignal' || action === 'generateReplies') {
    return 0.92;
  }

  return 0.78;
}

async function requestOpenAI(
  apiKey: string,
  action: Action,
  topic: string,
  signal: string,
  style: string,
  language: string,
  count: number,
  memory: Record<string, string>,
  persona: Record<string, string>,
  agent: string,
  remixMode: string,
  options: PostOptions,
  useJsonFormat: boolean
) {
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL || fallbackModel,
    input: buildPrompt(action, topic, signal, style, language, count, memory, persona, agent, remixMode, options),
    max_output_tokens: maxOutputTokensFor(action),
    temperature: temperatureFor(action)
  };

  if (useJsonFormat) {
    body.text = {
      format: {
        type: 'json_object'
      }
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openAiTimeoutMs);

  try {
    return await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function respondWithAiOutput(res: VercelResponse, payload: AiPayload) {
  const response = {
    signal: payload.signal || '',
    post: payload.post || '',
    items: payload.items || [],
    campaign: payload.campaign || null,
    summary: payload.summary || '',
    bullets: payload.bullets || [],
    notes: payload.notes || [],
    hashtags: payload.hashtags || [],
    emojis: payload.emojis || [],
    characterCount: payload.characterCount || 0
  };

  res.status(200).json(response);
}

function requireInput(action: Action, topic: string, signal: string, res: VercelResponse): boolean {
  if ((action === 'generatePost' || action === 'remixSignal' || action === 'remixContent') && !signal) {
    res.status(400).json({ error: 'Source signal required.' });
    return false;
  }

  if (action !== 'generatePost' && action !== 'remixSignal' && action !== 'remixContent' && !topic) {
    res.status(400).json({ error: 'Input signal required.' });
    return false;
  }

  return true;
}

function normalizeParsedPayload(action: Action, parsed: AiPayload, count: number, options: PostOptions): AiPayload | null {
  const hashtags = normalizeHashtags(parsed.hashtags, action === 'generateHashtags' ? count : 5);
  const emojis = normalizeEmojis(parsed.emojis);

  if (action === 'generatePost' || action === 'generateQuote' || action === 'remixContent' || action === 'remixSignal') {
    const post = normalizePost(parsed.post || parsed.signal, 300);
    const finalPost = assemblePost(post, hashtags, emojis, options);

    if (!post || finalPost.length > 280) {
      return null;
    }

    return {
      post,
      hashtags,
      emojis,
      characterCount: finalPost.length
    };
  }

  if (action === 'generateThread' || action === 'generateReplies') {
    const items = normalizeItems(parsed.items, count, 300);

    if (!items.length) {
      return null;
    }

    return {
      items,
      hashtags,
      emojis,
      characterCount: items.join('\n\n').length
    };
  }

  if (action === 'generateCampaign') {
    const campaign = normalizeCampaign(parsed.campaign);

    if (!Object.keys(campaign).length) {
      return null;
    }

    return {
      campaign,
      hashtags,
      emojis,
      characterCount: JSON.stringify(campaign).length
    };
  }

  if (action === 'summarizeResearch') {
    const summary = normalizePost(parsed.summary, 520);
    const post = normalizePost(parsed.post, 300);
    const items = normalizeItems(parsed.items, 4, 300);
    const bullets = normalizeItems(parsed.bullets, 8, 180);
    const notes = normalizeItems(parsed.notes, 8, 180);

    if (!summary && !post && !items.length && !bullets.length && !notes.length) {
      return null;
    }

    return {
      summary,
      post,
      items,
      bullets,
      notes,
      hashtags,
      emojis,
      characterCount: [summary, post, ...items, ...bullets, ...notes].filter(Boolean).join('\n').length
    };
  }

  if (action === 'generateHashtags') {
    if (!hashtags.length) {
      return null;
    }

    return {
      hashtags,
      characterCount: hashtags.join(' ').length
    };
  }

  const signal = normalizeSignal(parsed.signal || parsed.post);

  if (!signal) {
    return null;
  }

  return {
    signal,
    hashtags,
    emojis,
    characterCount: signal.length
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!enforceRequestProtection(req, res)) {
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'AI engine offline.' });
    return;
  }

  const body = normalizeBody(req.body);
  const action = normalizeAction(body.action);
  const topic = normalizeText(body.topic, maxTopicLength);
  const signalInput = normalizeText(body.signal, maxSignalLength);
  const style = normalizeStyle(body.style);
  const language = normalizeLanguage(body.language);
  const count = normalizeCount(action, body.count);
  const agent = normalizeAgent(body.agent);
  const memory = normalizeRecord(body.memory, 12);
  const persona = normalizeRecord(body.persona, 4);
  const remixMode = normalizeInlineText(body.remixMode, 60);
  const options = normalizeOptions(body.options);

  if (!requireInput(action, topic, signalInput, res)) {
    return;
  }

  try {
    let response = await requestOpenAI(
      apiKey,
      action,
      topic,
      signalInput,
      style,
      language,
      count,
      memory,
      persona,
      agent,
      remixMode,
      options,
      true
    );

    if (response.status === 400) {
      response = await requestOpenAI(
        apiKey,
        action,
        topic,
        signalInput,
        style,
        language,
        count,
        memory,
        persona,
        agent,
        remixMode,
        options,
        false
      );
    }

    if (response.status === 429) {
      res.status(429).json({ error: 'Synthesis queue saturated.' });
      return;
    }

    if (!response.ok) {
      res.status(502).json({ error: 'AI engine rejected the signal.' });
      return;
    }

    const parsed = parseJsonOutput(getOutputText(await response.json()));
    const payload = normalizeParsedPayload(action, parsed, count, options);

    if (!payload) {
      res.status(422).json({ error: 'AI engine returned unusable output.' });
      return;
    }

    respondWithAiOutput(res, payload);
  } catch (error) {
    res.status(502).json({ error: 'AI engine unavailable.' });
  }
}
