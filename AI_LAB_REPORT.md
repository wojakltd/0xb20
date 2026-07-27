# AI Lab Report

## Overview

AI Lab is the 0XB20 Laboratory AI Growth instrument at `/ai/`.

It is not a chatbot. It is a modular content synthesis engine for Web3 builders that generates:

- short signals;
- X posts;
- threads;
- replies;
- quote posts;
- launch campaigns;
- hashtag sets;
- research summaries;
- remixes of existing outputs.

The module preserves the Laboratory visual language and uses the existing Lab Pass licensing system.

## Architecture

```text
/ai/
  index.html
  ↓
ai/assets/js/ai-lab.js
  orchestration only
  ↓
ai/assets/js/ai-generator.js
  action dispatch + Lab Pass checks
  ↓
ai/assets/js/ai-core.js
  POST /api/ai/generate
  ↓
api/ai/generate.ts
  server-side OpenAI Responses API bridge
```

Supporting browser modules:

```text
ai-features.js   feature registry, modes, styles, languages, agents, prompt presets
ai-storage.js    LocalStorage memory, personas, outputs, posts, favourites
ai-preview.js    X preview assembly, character counting, local analysis
ai-library.js    prompt library access
```

No OpenAI key reaches the browser.

## Files Created

- `ai/assets/js/ai-core.js`
- `ai/assets/js/ai-features.js`
- `ai/assets/js/ai-generator.js`
- `ai/assets/js/ai-library.js`
- `ai/assets/js/ai-preview.js`
- `ai/assets/js/ai-storage.js`

## Files Modified

- `ai/index.html`
- `ai/assets/css/ai.css`
- `ai/assets/js/ai-lab.js`
- `api/ai/generate.ts`
- `data/web3-tools.json`
- `README.md`
- `AI_LAB_REPORT.md`

## API Flow

The endpoint remains:

```text
POST /api/ai/generate
```

The request body uses one `action` field:

```json
{
  "action": "generateSignal",
  "topic": "Base builders",
  "signal": "",
  "style": "builder",
  "language": "auto",
  "agent": "builder",
  "count": 4,
  "memory": {},
  "persona": {},
  "remixMode": "",
  "options": {
    "emojis": false,
    "hashtags": false,
    "attribution": false
  }
}
```

Supported actions:

- `generateSignal`
- `generatePost`
- `generateThread`
- `generateReplies`
- `generateQuote`
- `generateCampaign`
- `summarizeResearch`
- `generateHashtags`
- `remixContent`
- `remixSignal` legacy-compatible alias

The response is always structured JSON:

```json
{
  "signal": "",
  "post": "",
  "items": [],
  "campaign": null,
  "summary": "",
  "bullets": [],
  "notes": [],
  "hashtags": [],
  "emojis": [],
  "characterCount": 0
}
```

## Generation Flow

### Signal

```text
topic + style + language + agent + optional memory/persona
↓
generateSignal
↓
short memorable signal
```

### X Post

```text
current output
↓
generatePost
↓
post + hashtags + emojis
↓
frontend assembles final X preview based on selected options
```

### Thread

```text
topic + count
↓
generateThread
↓
numbered X thread items
```

### Replies

```text
tweet text or URL + count
↓
generateReplies
↓
distinct reply options
```

### Campaign

```text
launch objective
↓
generateCampaign
↓
launch post, launch thread, replies, quote tweet, follow-up, reminder, last chance, final update
```

### Research Summary

```text
article / long text / thread
↓
summarizeResearch
↓
summary, X post, thread, bullets, builder notes
```

## Premium Integration

AI Lab uses the existing Premium Core and Lab Pass contract.

It does not implement licensing internally.

Premium feature IDs are configured in `data/web3-tools.json`:

- `aiLabUnlimitedGenerations`
- `aiLabThreadGenerator`
- `aiLabCampaignGenerator`
- `aiLabProjectMemory`
- `aiLabSavedPersonas`
- `aiLabSavedOutputs`
- `aiLabAdvancedRemix`
- `aiLabResearchSummary`
- `aiLabPromptLibrary`

The frontend calls `window.B20Premium.requireAccess(featureId, label)` through `ai-core.js`.

## Project Memory

Project Memory is stored locally in the browser.

Fields:

- project;
- ticker;
- mission;
- website;
- GitHub;
- Base context;
- narrative;
- tone;
- target audience.

The data is optional and sent only as compact prompt context.

## Saved Personas

Default personas:

- Laboratory
- Brian
- Jesse
- Vitalik
- Professional
- Builder
- Founder
- Minimal
- Meme

Users can save custom personas locally. Persona access is gated through Lab Pass.

## Prompt Strategy

The system prompt defines the engine as:

- independent researcher;
- minimalist writer;
- builder;
- crypto observer.

It explicitly rejects:

- chatbot behavior;
- greetings;
- "As an AI";
- hype language;
- moon language;
- price predictions;
- financial advice;
- LinkedIn style;
- influencer phrasing;
- fake urgency;
- generic crypto slogans.

Every output must be original and concise.

## Cost Optimization

The module uses the standard OpenAI Responses API.

Cost controls:

- one endpoint;
- no assistants API;
- no threads API;
- no embeddings;
- no vector database;
- no streaming;
- no chat history;
- compact prompts;
- low `max_output_tokens` per action;
- per-IP minute throttling;
- per-IP daily budget guard;
- request size limit;
- server-side timeout.

Estimated token usage:

- Signal: roughly 150–350 input tokens and up to 150 output tokens.
- X Post: roughly 220–450 input tokens and up to 230 output tokens.
- Thread: roughly 300–650 input tokens and up to 900 output tokens.
- Campaign: roughly 350–750 input tokens and up to 1300 output tokens.

Actual cost depends on the configured `OPENAI_MODEL`.

## LocalStorage

The browser stores:

- recent outputs;
- recent X posts;
- favourites;
- project memory;
- custom personas;
- selected mode;
- selected style;
- selected language;
- selected agent.

No secrets are stored.

## Security

- `OPENAI_API_KEY` is read only inside `api/ai/generate.ts`.
- The frontend never calls OpenAI directly.
- The endpoint checks allowed origins.
- The endpoint limits request size.
- The endpoint rate-limits per client IP.
- The endpoint has a daily budget guard.
- The endpoint times out OpenAI requests.
- Lab Pass checks are on-chain through the existing Premium Core.
- AI Lab never requests wallet signatures, approvals, private keys, seed phrases, or transactions.

## Future Extension Points

- Admin-managed prompt packs.
- Premium generation quotas.
- Research module context import.
- Token Sender campaign presets.
- Wallet Parser airdrop campaign generation.
- Team-shared project memory.
- Export/import of local AI workspace.
