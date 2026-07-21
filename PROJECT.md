# 0XB20 Laboratory

Permanent knowledge base for future engineers and AI agents working on the 0XB20 website.

## Project Philosophy

0XB20 is an honest public experiment, not a generic crypto landing page.

The founder is building in public with almost no budget. The website should make visitors feel that the Laboratory is still alive, still unstable, and still being maintained by a real person.

Never add fake hype, fake urgency, fake partnerships, fake roadmaps, or generic crypto language.

## Laboratory World

- B20 is treated like a digital organism.
- Wallets are Hosts.
- NFTs are Specimens.
- Updates are Laboratory observations.
- The website is the Laboratory Operating System.
- The tone is honest, technical, weird, and in-universe.

## Architecture

The site is static and must remain lightweight:

- Pure HTML
- Pure CSS
- Vanilla JavaScript
- Static JSON data
- No runtime app backend for visitors except narrow serverless API routes that protect third-party secrets
- Node.js is allowed only for Research fetcher automation and narrow serverless API routes
- No frameworks
- No browser/frontend dependencies

The public frontend must remain static. Research backend code only updates JSON cache files through cron or manual scripts.

HTML should define module shells only. Expandable content should come from `data/` whenever possible.

## Folder Structure

- `index.html` is the main Laboratory Operating System shell.
- `logs/index.html` is the Laboratory Archive page at `/logs/`.
- `research/index.html` is the Research observation terminal at `/research/`.
- `ai/index.html` is the public AI Lab idea synthesis terminal at `/ai/`.
- `test/index.html` is the password-gated Web3 sandbox at `/test/`.
- `evolution/index.html` is the Laboratory Evolution Tree page at `/evolution/`.
- `protocol/index.html` is a legacy redirect to `/evolution/`.
- `style.css` is a compatibility stylesheet that imports modular CSS.
- `script.js` is the homepage bootstrapper.
- `assets/css/` contains design tokens, layout, components, and effects.
- `assets/js/` contains independent browser modules.
- `data/` contains the editable source of truth for live content.
- `research/backend/` contains the provider-agnostic Research fetcher.
- `api/ai/generate.ts` contains the server-only OpenAI bridge for AI Lab.
- `test/assets/` contains the isolated Web3 test module runtime.

## JSON Schemas

### `data/logs.json`

Legacy manual Laboratory records live here. This file is now a preserved archive of early experiments, not the source of future project history.

```json
{
  "id": 27,
  "logNumber": "013",
  "entryLabel": "LOG #013",
  "title": "Example Prototype Record",
  "date": "2026-07-17",
  "type": "archive",
  "summary": "Short preserved archive summary.",
  "content": "Full preserved archive text...",
  "tags": ["archive", "research"],
  "featured": false,
  "link": "/research/",
  "linkLabel": "→ Open Research Terminal"
}
```

Supported log filters:

- `deployment`
- `research`
- `incident`
- `website`
- `scanner`
- `nft`
- `console`

The homepage renders the newest Prototype Record. `featured` remains only as legacy compatibility metadata.

### `data/status.json`

Drives the System Status panel.

```json
{
  "laboratoryStatus": "ONLINE",
  "currentExperiment": "Research Infrastructure",
  "developmentProgress": 36,
  "currentNetwork": "BASE",
  "currentHosts": "900+",
  "lastUpdate": "auto"
}
```

### `data/scanner.json`

Drives scanner steps, report outcomes, rare messages, and easter eggs.

### `data/terminal-events.json`

Feeds the passive Laboratory Terminal process monitor.

### `data/evolution.json`

Drives the Laboratory Evolution Tree. This is a visual research map, not a roadmap or documentation page.

Top-level sections:

- `hero`
- `telemetry`
- `phases`
- `terminal`

Each phase supports:

```json
{
  "id": 2,
  "title": "SIGNAL DETECTION",
  "subtitle": "The Laboratory begins observing the ecosystem.",
  "description": "The next research layer studies public ecosystem signals.",
  "status": "PLANNED",
  "completed": false,
  "current": false,
  "objectives": ["Base Signal Monitor"],
  "notes": "Research determines what survives."
}
```

### `research/backend/cache/feed.json`

Drives the Research module. The frontend consumes this cache only and does not know which provider created it.

```json
{
  "metadata": {
    "version": 2,
    "provider": "laboratory+reader",
    "backendProvider": "laboratory+reader",
    "generatedAt": "2026-07-15T02:05:03.598Z",
    "durationMs": 99322,
    "accounts": 36,
    "posts": 299,
    "latestObservationAt": "2026-07-14T19:27:31.886Z",
    "refreshIntervalMinutes": 10,
    "networks": ["BASE"],
    "categories": ["laboratory", "official"],
    "failures": []
  },
  "posts": [
    {
      "id": "stable-post-id",
      "author": "Base",
      "displayName": "Base",
      "username": "base",
      "avatar": "",
      "verified": false,
      "text": "Post text",
      "created_at": "2026-07-15T00:00:00.000Z",
      "createdAt": "2026-07-15T00:00:00.000Z",
      "images": [],
      "video": "",
      "post_url": "https://x.com/base/status/...",
      "url": "https://x.com/base/status/...",
      "category": "official",
      "network": "BASE",
      "partner": false,
      "partner_label": "",
      "priority": 0,
      "favorite": false,
      "source": "reader"
    }
  ]
}
```

## Terminology

- Use `Host`, not user wallet.
- Use `Specimen`, not NFT item.
- Use `Laboratory Log`, not blog post.
- Use `Experiment`, not roadmap milestone.
- Use `Research in progress`, `In Development`, or `Currently under observation`, not `Coming Soon`.

Never use:

- Moon
- 100x
- Pump
- LFG

## Design Rules

- Keep the current dark Base-blue cyber laboratory identity.
- Use glass panels, blue glow, grid background, monospace terminal language.
- Do not redesign into a marketing landing page.
- Interactions should feel subtle and premium.
- Animations must remain smooth and intentional.
- Avoid visual clutter and excessive motion.

## Coding Rules

- Keep modules small and independent.
- Prefer JSON-driven rendering over HTML edits.
- Use `textContent` for dynamic user-visible content.
- Fetch failures must show in-universe fallback text.
- Do not throw console errors for missing data.
- Do not add browser/frontend dependencies.
- Keep backend Research dependencies minimal and isolated inside `research/backend/`.
- Keep experimental Web3 dependencies isolated inside `/test/` if a build step is introduced later.
- Keep third-party API keys server-side only. Browser modules must never read or contain secrets.
- Preserve root compatibility files.

## Current JavaScript Modules

- `assets/js/config.js` defines paths, boot text, and fallbacks.
- `assets/js/data-loader.js` loads and normalizes JSON.
- `assets/js/ui.js` renders homepage UI modules.
- `assets/js/scanner.js` runs the simulated Host Scanner.
- `assets/js/live-terminal.js` streams Research-derived activity and passive terminal lines.
- `assets/js/terminal.js` owns the Laboratory Console command registry.
- `assets/js/logs-page.js` renders the `/logs/` archive.
- `assets/js/evolution-page.js` renders `/evolution/` from `data/evolution.json`.
- `assets/js/access-gate.js` contains reusable client-side access-gate behavior.
- `ai/assets/js/ai-lab.js` renders `/ai/` and calls only the server endpoint.
- `research/assets/js/research.js` renders `/research/` from `research/backend/cache/feed.json`.
- `test/assets/js/test-wallet.js` renders `/test/` wallet experiments with read-only wallet methods.
- `assets/js/interactions.js` adds pointer-reactive glow effects.

## How To Add A New Legacy Record

Manual Terminal Logs are discontinued for future project history.

Only use this path for preserving or correcting early archive records:

1. Open `data/logs.json`.
2. Add or edit an object with the full legacy log schema.
3. Use a stable `id` and `logNumber`.
4. Keep `featured` for compatibility only; the homepage uses the newest record.

New official project history should be published through `@0xb20lol` and imported into Research.

## How To Add A Scanner Result

Edit `data/scanner.json`.

- Add scan steps to `steps`.
- Add report values to `hostStatuses`, `hostStability`, `riskLevels`, or `recommendations`.
- Add rare text to `rareMessages`.
- Add keyword responses under `easterEggs`.

## How To Add A Terminal Command

Open `assets/js/terminal.js` and add one command to `commandRegistry`.

Static command:

```js
example: {
  lines: ['Laboratory response.']
}
```

Dynamic command:

```js
example: {
  handler(context) {
    return ['Dynamic response.'];
  }
}
```

## How To Add New Status

Edit `data/status.json`. If the visual shape changes, update `renderStatus` in `assets/js/ui.js`.

## How To Update Evolution

Edit `data/evolution.json`.

- Change `hero.progress` and `telemetry.progress` to update progress bars.
- Add future phases to `phases`.
- Use `state: "completed"`, `state: "current"`, or `state: "future"`.
- Keep phase copy short enough to scan in seconds.
- Never describe Evolution phases as a roadmap or promise.

## How To Update Research

- Add or remove observed accounts in `research/backend/config/accounts.json`.
- Accounts support `partner`, `partnerName`, `priority`, `favorite`, `hidden`, `description`, `website`, and `logo`.
- Change provider settings in `research/backend/config/provider.json`.
- Keep provider-specific logic inside `research/backend/providers/`.
- Provider order is `laboratory`, `playwright`, `reader`, `rss`, preserved `cache`, then `sample`.
- `laboratory` is the only entry point for official 0XB20 history and currently delegates to `xapi`.
- `xapi` uses official X API bearer-token auth and must never be called directly outside `laboratory.js`.
- Laboratory sync cadence is 12 hours by default for API quota conservation.
- `sample` exists only as a development fallback and is removed automatically once real provider data exists.
- The `laboratory` category is reserved for 0XB20's own observation source and receives a small sorting boost only when posts are close in time.
- Research timestamps should prefer X Snowflake IDs over reader text labels.
- `maxPostAgeDays` prevents stale posts from staying in the public feed.
- Accounts can define `minCreatedAt` and `minPostId`; `0xb20lol` starts at status `2076659510803079325`.
- Future networks are represented by the `network` string. Do not hardcode Base-only assumptions into new providers.
- Never make the frontend depend on a provider.
- Refresh cache with `cd research/backend && npm run fetch`.
- The GitHub Action `.github/workflows/research-fetch.yml` refreshes `research/backend/cache/feed.json` every 10 minutes.

## How To Update AI Lab

AI Lab lives at `/ai/` and is public. The shared access gate mechanism is preserved for future restricted instruments.

- Browser code lives in `ai/assets/js/ai-lab.js`.
- Visual module styles live in `ai/assets/css/ai.css`.
- The frontend calls only `/api/ai/generate`.
- The OpenAI key must be stored as `OPENAI_API_KEY` in `.env.local` for local work and in Vercel Environment Variables for production.
- Optional model override: `OPENAI_MODEL`.
- The endpoint uses one low-token Responses API request per action and supports `generateSignal`, `generatePost`, and `remixSignal`.
- `generateSignal` and `remixSignal` return only a signal; `generatePost` returns post text plus AI-generated hashtag and emoji arrays.
- Never hardcode keys, model credentials, generated history, or private prompts in frontend files.

## How To Update Test Lab

The Test Lab lives at `/test/` and is protected by the shared access gate.

- Browser code lives in `test/assets/js/test-wallet.js`.
- Visual module styles live in `test/assets/css/test.css`.
- TypeScript contracts live in `test/src/wallet-contracts.ts`.
- Current wallet methods are read-only except `personal_sign` for the signature demo.
- Never add `approve`, `permit`, `transfer`, or `eth_sendTransaction` to this sandbox without explicit review.
- WalletConnect QR support requires a public WalletConnect/Reown project id before enabling the adapter.

## Future Modules

- Genesis Collection
- Specimen Database
- Host Rankings
- World Infection Map
- Scanner history
- Public build log timeline

## Production Rule

If a future update can be represented as data, put it in `data/`. Touch HTML only when creating a new module shell.
