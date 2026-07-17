type VercelRequest = {
  method?: string;
  body?: unknown;
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

const allowedActions = new Set<Action>(['generateSignal', 'generatePost', 'remixSignal']);
const allowedStyles = new Set(['minimal', 'funny', 'philosophy', 'brutal', 'builder']);
const fallbackModel = 'gpt-4.1-mini';
const maxTopicLength = 180;
const maxSignalLength = 320;
const attributionText = 'Generated with https://0xb20.lol/ai';

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
    .filter((tag) => /^#[A-Za-z0-9_]{2,32}$/.test(tag));
}

function normalizeEmojis(values: unknown): string[] {
  return uniqueStrings(values, 5).filter((emoji) => emoji.length <= 8);
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
  const parts = [post.trim()];

  if (options.emojis && emojis.length) {
    parts.push(emojis.join(' '));
  }

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
    'You are the 0XB20 Laboratory idea synthesis engine: experienced independent researcher, minimalist writer, builder, crypto observer. No hype, moon language, price predictions, financial advice, fake confidence, roleplay, greetings, explanations, famous quotes, LinkedIn tone, influencer language, or "As an AI". Return valid JSON only.';

  if (action === 'generatePost') {
    return `${base} Generate one shareable X transmission from the provided signal. Generate relevant emojis and hashtags only as arrays; do not append them to the post text.`;
  }

  if (action === 'remixSignal') {
    return `${base} Remix the provided signal into a genuinely different angle, structure, and perspective. Do not perform synonym replacement.`;
  }

  return `${base} Generate one memorable screenshot-worthy signal.`;
}

function buildUserPrompt(action: Action, topic: string, signal: string, style: string, options: PostOptions): string {
  if (action === 'generatePost') {
    const maxBaseLength = options.attribution || options.hashtags || options.emojis ? 175 : 220;

    return [
      `signal: ${signal}`,
      `style: ${style}`,
      `topic context for relevance only: ${topic || 'none'}`,
      `base post max characters: ${maxBaseLength}`,
      'Write one original X post based only on the signal.',
      'No thread, no essay, no greeting, no generic crypto slogan.',
      'If emojis fit, return 1-3 intelligent emojis, max 5. If none fit, return [].',
      'If hashtags fit, return 1-4 highly relevant hashtags, max 5. If none fit, return [].',
      `JSON shape: ${buildJsonShape(action)}`
    ].join('\n');
  }

  if (action === 'remixSignal') {
    return [
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
    `topic: ${topic}`,
    `style: ${style}`,
    'Create one signal only.',
    'Maximum 35 words. Maximum two short sentences. Shorter is better.',
    'It must feel memorable, concrete, and screenshot-worthy.',
    'No paragraph, no explanation, no thread, no fake wisdom.',
    `JSON shape: ${buildJsonShape(action)}`
  ].join('\n');
}

function buildPrompt(action: Action, topic: string, signal: string, style: string, options: PostOptions) {
  return [
    {
      role: 'system',
      content: buildSystemPrompt(action)
    },
    {
      role: 'user',
      content: buildUserPrompt(action, topic, signal, style, options)
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
  options: PostOptions,
  useJsonFormat: boolean
) {
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL || fallbackModel,
    input: buildPrompt(action, topic, signal, style, options),
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

  return fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
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

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
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
    let response = await requestOpenAI(apiKey, action, topic, signalInput, style, options, true);

    if (response.status === 400) {
      response = await requestOpenAI(apiKey, action, topic, signalInput, style, options, false);
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
