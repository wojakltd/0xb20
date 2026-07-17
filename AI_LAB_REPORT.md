# AI Lab Report

## Overview

AI Lab is a password-gated Laboratory instrument at `/ai/`.
It generates one short signal and one X-ready transmission from a user topic and style.
It is not a chatbot, does not store conversation history, and does not expose OpenAI credentials to the browser.

## Architecture

The module keeps the existing static frontend model and adds one narrow serverless boundary:

```text
/ai/
  browser UI
  ↓ POST topic/style
/api/ai/generate
  server-only OpenAI call
  ↓
OpenAI Responses API
```

The frontend never calls OpenAI directly. It only calls the internal endpoint.

## Files Created

- `ai/index.html`
- `ai/assets/css/ai.css`
- `ai/assets/js/ai-lab.js`
- `api/ai/generate.ts`
- `assets/js/access-gate.js`
- `.env.example`
- `AI_LAB_REPORT.md`

## Files Modified

- `index.html`
- `logs/index.html`
- `research/index.html`
- `evolution/index.html`
- `README.md`
- `PROJECT.md`
- `.gitignore`
- `vercel.json`

## API Flow

1. Visitor unlocks `/ai/` with the Laboratory key.
2. Browser submits `topic` and `style` to `/api/ai/generate`.
3. Server validates and trims input.
4. Server calls the OpenAI Responses API using `OPENAI_API_KEY`.
5. Server requests JSON only: one `signal` and one `post`.
6. Server normalizes the output and returns JSON to the browser.
7. Browser renders the Signal card and keeps the X-ready transmission available without a second API call.

## Environment Variables

Required:

```bash
OPENAI_API_KEY=
```

Optional:

```bash
OPENAI_MODEL=gpt-4.1-mini
```

Use `.env.local` locally. Use Vercel Project Settings → Environment Variables in production.

## Security

- `OPENAI_API_KEY` is read only inside `api/ai/generate.ts`.
- The browser never receives the key.
- `.env`, `.env.local`, `.env.*`, and `*.env` remain ignored.
- `.env.example` is explicitly allowed because it contains no secret values.
- The endpoint returns generic failure messages and does not leak provider errors.

## Password Protection

The existing Research access-gate behavior was extracted into `assets/js/access-gate.js`.
AI Lab reuses that shared client-side mechanism with:

```text
password: 0xb20.lol
storage: b20-ai-lab-access
```

Only `/ai/` is gated. Research remains public.

## Cost Optimization

The endpoint is intentionally cheap:

- one request per generation
- no memory
- no chat history
- no streaming
- no embeddings
- no assistants
- no vector database
- small prompt
- `max_output_tokens` set to `170`

Approximate usage per generation is expected to be around 120-220 input tokens and up to 170 output tokens.

## Future Ideas

- Server-side rate limiting.
- Saved local drafts in browser storage.
- More Laboratory-specific style presets.
- Optional moderation layer.
- Research-derived topic suggestions.
- Admin-only prompt tuning stored outside frontend code.
