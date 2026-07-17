# AI Lab Report

## Overview

AI Lab is a password-gated Laboratory instrument at `/ai/`.
It is an idea synthesis engine, not a chatbot.
The tool generates short signals, remixes them into different angles, and turns the current signal into X-ready transmissions.

## Architecture

The module keeps the existing 0XB20 frontend architecture:

```text
/ai/
  static browser UI
  ↓ POST action payload
/api/ai/generate
  single server-only OpenAI bridge
  ↓
OpenAI Responses API
```

No new endpoint was added.
The existing endpoint now supports multiple actions through the `action` parameter.

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
- `ai/index.html`
- `ai/assets/css/ai.css`
- `ai/assets/js/ai-lab.js`
- `api/ai/generate.ts`

## API Flow

### Generate Signal

```text
topic + style
↓
POST /api/ai/generate
action: generateSignal
↓
OpenAI request
↓
{ signal, post:"", hashtags:[], emojis:[], characterCount }
```

This request returns only a concise signal.

### Remix Signal

```text
current signal + style
↓
POST /api/ai/generate
action: remixSignal
↓
OpenAI request
↓
new signal with different angle
```

The remix prompt asks for a genuinely different perspective, not synonym replacement.

### Generate X Post

```text
current signal + style + selected options
↓
POST /api/ai/generate
action: generatePost
↓
OpenAI request
↓
{ post, hashtags, emojis, characterCount }
↓
frontend assembles final post
```

Every `Generate X Post` click makes a fresh API request.
No previous post is reused.

## New UI Elements

- Optional `Add emojis` checkbox.
- Optional `Add hashtags` checkbox.
- Optional `Append AI LAB attribution` checkbox.
- Live `current / 280` character counter.
- `Publish to X` button using `https://twitter.com/intent/tweet?text=...`.
- Tweet-like preview formatting that preserves the same line breaks sent to X.
- Separate `Copy Signal` and `Copy X Post` buttons.
- Local memory panels for recent signals, recent X posts, and favourite signals.
- `Save Favourite` action for signals.

## Prompt Strategy

The system prompt defines the engine as:

- experienced independent researcher
- minimalist writer
- builder
- crypto observer

It explicitly rejects:

- chatbot behavior
- greetings
- "As an AI"
- hype language
- price predictions
- financial advice
- LinkedIn style
- influencer phrasing
- generic crypto slogans
- copied famous quotes

Signals are constrained to:

- maximum 35 words
- maximum two short sentences
- no paragraphs
- no essays
- no threads

X posts are generated from the current signal and remain compact enough for optional additions.

## API Improvements

The endpoint now supports:

```json
{
  "action": "generateSignal | generatePost | remixSignal",
  "topic": "optional topic context",
  "signal": "current signal for post/remix",
  "style": "minimal",
  "options": {
    "emojis": false,
    "hashtags": false,
    "attribution": false
  }
}
```

The response shape is always:

```json
{
  "signal": "",
  "post": "",
  "hashtags": [],
  "emojis": [],
  "characterCount": 0
}
```

## Cost Optimization

The cheapest stable flow is preserved:

- `Generate Signal` = one OpenAI request returning only `signal`.
- `Generate X Post` = one OpenAI request returning `post`, `hashtags`, and `emojis`.
- `Remix` = one OpenAI request returning only a new `signal`.

There are no separate emoji or hashtag requests.
There is no memory sent to the model.
There are no assistants, threads, embeddings, vector databases, or streaming.

Current token caps:

- Signal/remix: `max_output_tokens` 90.
- X post: `max_output_tokens` 190.

Estimated usage:

- Signal: ~90-170 input tokens, up to 90 output tokens.
- X post: ~130-240 input tokens, up to 190 output tokens.

## LocalStorage Implementation

The browser stores only local user output:

- `b20-ai-lab-signals`
- `b20-ai-lab-posts`
- `b20-ai-lab-favorites`

Each list keeps the latest 10 entries.
No backend database is used.
No generated history is sent back to OpenAI.

## Why Hashtags Are AI-Generated

Hardcoded hashtag dictionaries would create generic spam.
The model infers hashtags from the current signal, style, topic context, and generated post in the same post-generation request.
The endpoint normalizes the result and caps hashtags at five.

## Why Emojis Are AI-Generated

Emoji selection depends on the actual tone and subject.
The model decides whether emojis fit and returns a capped array.
The frontend appends approved emojis inline at the end of the main post paragraph, so they do not float as a disconnected standalone line.
There is no static emoji dictionary.

## Security

- `OPENAI_API_KEY` is read only inside `api/ai/generate.ts`.
- The browser never receives the key.
- `.env`, `.env.local`, `.env.*`, and `*.env` remain ignored.
- `.env.example` contains only empty placeholders.
- Provider errors are converted into Laboratory-style public errors.

## Password Protection

AI Lab continues to reuse `assets/js/access-gate.js`.
Only `/ai/` is protected with the `b20-ai-lab-access` session key.
Research remains public.

## Future Ideas

- Server-side rate limiting.
- Admin-editable prompt presets.
- Optional prompt telemetry without storing user secrets.
- Research-derived topic suggestions.
- Saved favourite posts.
- Export local memory as JSON.
