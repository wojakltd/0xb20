type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type GenerateBody = {
  topic?: unknown;
  style?: unknown;
};

const allowedStyles = new Set(['minimal', 'funny', 'philosophy', 'brutal', 'builder']);
const fallbackModel = 'gpt-4.1-mini';
const maxTopicLength = 180;

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

function normalizeTopic(topic: unknown): string {
  if (typeof topic !== 'string') {
    return '';
  }

  return topic.trim().replace(/\s+/g, ' ').slice(0, maxTopicLength);
}

function normalizeStyle(style: unknown): string {
  if (typeof style !== 'string') {
    return 'minimal';
  }

  const normalized = style.trim().toLowerCase();
  return allowedStyles.has(normalized) ? normalized : 'minimal';
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

function parseJsonOutput(text: string): { signal?: string; post?: string } {
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

function sanitizeOutput(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\n{3,}/g, '\n\n').slice(0, maxLength);
}

function normalizePost(value: unknown): string {
  const signature = '— 0XB20 Laboratory';
  let post = sanitizeOutput(value, 320);

  if (!post) {
    return '';
  }

  if (!post.includes(signature)) {
    post = `${post.replace(/\s+—\s*0XB20 Laboratory$/i, '').trim()}\n\n${signature}`;
  }

  if (post.length <= 240) {
    return post;
  }

  const contentLimit = 240 - signature.length - 2;
  const content = post
    .replace(signature, '')
    .trim()
    .slice(0, Math.max(contentLimit, 0))
    .replace(/\s+\S*$/, '')
    .trim();

  return `${content}\n${signature}`.slice(0, 240);
}

function buildPrompt(topic: string, style: string) {
  return [
    {
      role: 'system',
      content:
        'You are the 0XB20 Laboratory idea synthesis engine. Never chat, greet, explain, use emojis, copy famous quotes, or sound motivational. Write original concise crypto observations in an independent researcher voice. Return valid JSON only.'
    },
    {
      role: 'user',
      content:
        `topic: ${topic}\n` +
        `style: ${style}\n` +
        'Create exactly one signal of 15-35 words and one X post of 220-240 characters signed with — 0XB20 Laboratory. JSON shape: {"signal":"...","post":"..."}'
    }
  ];
}

async function requestOpenAI(apiKey: string, topic: string, style: string, useJsonFormat: boolean) {
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL || fallbackModel,
    input: buildPrompt(topic, style),
    max_output_tokens: 170,
    temperature: 0.82
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'AI engine unavailable.' });
    return;
  }

  const body = normalizeBody(req.body);
  const topic = normalizeTopic(body.topic);
  const style = normalizeStyle(body.style);

  if (!topic) {
    res.status(400).json({ error: 'Input signal required.' });
    return;
  }

  try {
    let response = await requestOpenAI(apiKey, topic, style, true);

    if (response.status === 400) {
      response = await requestOpenAI(apiKey, topic, style, false);
    }

    if (!response.ok) {
      res.status(502).json({ error: 'AI engine unavailable.' });
      return;
    }

    const payload = await response.json();
    const parsed = parseJsonOutput(getOutputText(payload));
    const signal = sanitizeOutput(parsed.signal, 260);
    const post = normalizePost(parsed.post);

    if (!signal || !post) {
      res.status(502).json({ error: 'AI engine returned unreadable signal.' });
      return;
    }

    res.status(200).json({ signal, post });
  } catch (error) {
    res.status(502).json({ error: 'AI engine unavailable.' });
  }
}
