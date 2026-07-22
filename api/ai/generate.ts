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

type Action = 'generateSignal' | 'generatePost' | 'remixSignal';

type GenerateBody = {
  action?: unknown;
  topic?: unknown;
  signal?: unknown;
  style?: unknown;
  language?: unknown;
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
  hashtags?: string[];
  emojis?: string[];
};

type RateEntry = {
  count: number;
  resetAt: number;
};

const allowedActions = new Set<Action>(['generateSignal', 'generatePost', 'remixSignal']);
const allowedStyles = new Set(['minimal', 'funny', 'philosophy', 'brutal', 'builder']);
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
const maxTopicLength = 180;
const maxSignalLength = 320;
const maxRequestBytes = 4096;
const rateWindowMs = 60 * 1000;
const dailyWindowMs = 24 * 60 * 60 * 1000;
const defaultMinuteLimit = 20;
const defaultDailyLimit = 300;
const maxRateEntries = 1000;
const openAiTimeoutMs = 15 * 1000;
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

  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeStyle(style: unknown): string {
  if (typeof style !== 'string') {
    return 'minimal';
  }

  const normalized = style.trim().toLowerCase();
  return allowedStyles.has(normalized) ? normalized : 'minimal';
}

function normalizeLanguage(language: unknown): string {
  if (typeof language !== 'string') {
    return 'auto';
  }

  const normalized = language.trim().toLowerCase();
  return outputLanguages[normalized] ? normalized : 'auto';
}

function languageInstruction(language: string): string {
  return `output language: ${outputLanguages[normalizeLanguage(language)]}`;
}

function normalizeOptions(options: unknown): PostOptions {
  const source = options && typeof options === 'object' ? options as Record<string, unknown> : {};

  return {
    emojis: source.emojis === true,
    hashtags: source.hashtags === true,
    attribution: source.attribution === true
  };
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

function normalizeHashtags(values: unknown): string[] {
  return uniqueStrings(values, 5)
    .map((tag) => tag.replace(/\s+/g, '').replace(/^#?/, '#'))
    .filter((tag) => /^#[\p{L}\p{N}_]{2,32}$/u.test(tag));
}

function normalizeEmojis(values: unknown): string[] {
  return uniqueStrings(values, 3).filter((emoji) => emoji.length <= 8);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeSignal(value: unknown): string {
  let signal = normalizeText(value, maxSignalLength);

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

  return signal.replace(/\s+([,.!?])/g, '$1').trim();
}

function normalizePost(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
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

function buildJsonShape(action: Action): string {
  if (action === 'generatePost') {
    return '{"signal":"","post":"...","hashtags":["#Base"],"emojis":["🧪"],"characterCount":0}';
  }

  return '{"signal":"...","post":"","hashtags":[],"emojis":[],"characterCount":0}';
}

function buildSystemPrompt(action: Action): string {
  const base =
    'You are the 0XB20 Laboratory idea synthesis engine: experienced independent researcher, minimalist writer, builder, crypto observer. Write natively in the requested output language; never translate literally. No hype, moon language, price predictions, financial advice, fake confidence, roleplay, greetings, explanations, famous quotes, LinkedIn tone, influencer language, or "As an AI". Return valid JSON only.';

  if (action === 'generatePost') {
    return `${base} Generate one shareable X transmission from the provided signal. Return emojis as subtle inline ending accents only; do not put them inside post text. Return hashtags only as an array.`;
  }

  if (action === 'remixSignal') {
    return `${base} Remix the provided signal into a genuinely different angle, structure, and perspective. Do not perform synonym replacement.`;
  }

  return `${base} Generate one memorable screenshot-worthy signal.`;
}

function buildUserPrompt(action: Action, topic: string, signal: string, style: string, language: string, options: PostOptions): string {
  if (action === 'generatePost') {
    const maxBaseLength = options.attribution || options.hashtags || options.emojis ? 175 : 220;

    return [
      languageInstruction(language),
      `signal: ${signal}`,
      `style: ${style}`,
      `topic context for relevance only: ${topic || 'none'}`,
      `base post max characters: ${maxBaseLength}`,
      'Write one original X post based only on the signal.',
      'No thread, no essay, no greeting, no generic crypto slogan.',
      'If emojis truly fit, return 1-3 intelligent emojis for the end of the main post. If none fit, return [].',
      'Never return random decorative emojis, object spam, or emojis that feel disconnected from the post.',
      'If hashtags fit, return 1-4 highly relevant hashtags, max 5. If none fit, return [].',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'remixSignal') {
    return [
      languageInstruction(language),
      `current signal: ${signal}`,
      `topic context: ${topic || 'none'}`,
      `style: ${style}`,
      'Create one new signal with a different angle and structure.',
      'Maximum 35 words. Maximum two short sentences. No paragraph.',
      'Make it memorable, concrete, and screenshot-worthy.',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  return [
    languageInstruction(language),
    `topic: ${topic}`,
    `style: ${style}`,
    'Create one signal only.',
    'Maximum 35 words. Maximum two short sentences. Shorter is better.',
    'It must feel memorable, concrete, and screenshot-worthy.',
    'No paragraph, no explanation, no thread, no fake wisdom.',
    `JSON shape: ${buildJsonShape(action)}`
  ].join('\n');
}

function buildPrompt(action: Action, topic: string, signal: string, style: string, language: string, options: PostOptions) {
  return [
    {
      role: 'system',
      content: buildSystemPrompt(action)
    },
    {
      role: 'user',
      content: buildUserPrompt(action, topic, signal, style, language, options)
    }
  ];
}

function maxOutputTokensFor(action: Action): number {
  return action === 'generatePost' ? 190 : 90;
}

async function requestOpenAI(
  apiKey: string,
  action: Action,
  topic: string,
  signal: string,
  style: string,
  language: string,
  options: PostOptions,
  useJsonFormat: boolean
) {
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL || fallbackModel,
    input: buildPrompt(action, topic, signal, style, language, options),
    max_output_tokens: maxOutputTokensFor(action),
    temperature: action === 'remixSignal' ? 0.94 : 0.82
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

function respondWithAiOutput(res: VercelResponse, payload: {
  signal?: string;
  post?: string;
  hashtags?: string[];
  emojis?: string[];
  characterCount?: number;
}) {
  const response = {
    signal: payload.signal || '',
    post: payload.post || '',
    hashtags: payload.hashtags || [],
    emojis: payload.emojis || [],
    characterCount: payload.characterCount || 0
  };

  res.status(200).json(response);
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
  const options = normalizeOptions(body.options);

  if (action === 'generateSignal' && !topic) {
    res.status(400).json({ error: 'Input signal required.' });
    return;
  }

  if ((action === 'generatePost' || action === 'remixSignal') && !signalInput) {
    res.status(400).json({ error: 'Source signal required.' });
    return;
  }

  try {
    let response = await requestOpenAI(apiKey, action, topic, signalInput, style, language, options, true);

    if (response.status === 400) {
      response = await requestOpenAI(apiKey, action, topic, signalInput, style, language, options, false);
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

    if (action === 'generatePost') {
      const post = normalizePost(parsed.post);
      const hashtags = normalizeHashtags(parsed.hashtags);
      const emojis = normalizeEmojis(parsed.emojis);
      const finalPost = assemblePost(post, hashtags, emojis, options);

      if (!post || finalPost.length > 280) {
        res.status(422).json({ error: 'Transmission exceeded X limit.' });
        return;
      }

      respondWithAiOutput(res, {
        post,
        hashtags,
        emojis,
        characterCount: finalPost.length
      });
      return;
    }

    const signal = normalizeSignal(parsed.signal);

    if (!signal) {
      res.status(502).json({ error: 'AI engine returned unreadable signal.' });
      return;
    }

    respondWithAiOutput(res, {
      signal,
      characterCount: signal.length
    });
  } catch (error) {
    res.status(502).json({ error: 'AI engine unavailable.' });
  }
}
