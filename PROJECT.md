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
- Updates are Laboratory Logs.
- The website is the Laboratory Operating System.
- The tone is honest, technical, weird, and in-universe.

## Architecture

The site is static and must remain lightweight:

- Pure HTML
- Pure CSS
- Vanilla JavaScript
- Static JSON data
- No runtime app backend for visitors
- Node.js is allowed only for Research fetcher automation
- No frameworks
- No dependencies

The public frontend must remain static. Research backend code only updates JSON cache files through cron or manual scripts.

HTML should define module shells only. Expandable content should come from `data/` whenever possible.

## Folder Structure

- `index.html` is the main Laboratory Operating System shell.
- `logs/index.html` is the Laboratory Archive page at `/logs/`.
- `research/index.html` is the Research observation terminal at `/research/`.
- `evolution/index.html` is the Laboratory Evolution Tree page at `/evolution/`.
- `protocol/index.html` is a legacy redirect to `/evolution/`.
- `style.css` is a compatibility stylesheet that imports modular CSS.
- `script.js` is the homepage bootstrapper.
- `assets/css/` contains design tokens, layout, components, and effects.
- `assets/js/` contains independent browser modules.
- `data/` contains the editable source of truth for live content.
- `research/backend/` contains the provider-agnostic Research fetcher.

## JSON Schemas

### `data/logs.json`

All Laboratory Logs live here. Adding a log should only require editing this file.

```json
{
  "id": 15,
  "logNumber": "015",
  "title": "Laboratory Console Activated",
  "date": "2026-07-12",
  "type": "deployment",
  "summary": "Visitors can now communicate with the Laboratory.",
  "content": "Today the first interactive terminal entered production...",
  "tags": ["console", "website", "deployment"],
  "featured": true
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

The homepage renders the first log with `featured: true`. If none exists, it renders the newest log.

### `data/activity.json`

Drives the Activity Feed.

```json
{
  "time": "23:11",
  "title": "Windows resurrected"
}
```

### `data/status.json`

Drives the System Status panel.

```json
{
  "laboratoryStatus": "ONLINE",
  "currentExperiment": "Blockchain Infection Scanner",
  "developmentProgress": 37,
  "currentNetwork": "BASE",
  "currentHosts": "100+",
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
  "id": "stable-post-id",
  "author": "Base",
  "username": "base",
  "avatar": "",
  "verified": false,
  "text": "Post text",
  "created_at": "2026-07-15T00:00:00.000Z",
  "relative_time": "4h ago",
  "images": [],
  "video": "",
  "post_url": "https://x.com/base/status/...",
  "likes": 0,
  "replies": 0,
  "reposts": 0,
  "category": "official",
  "network": "BASE"
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
- Do not add dependencies.
- Preserve root compatibility files.

## Current JavaScript Modules

- `assets/js/config.js` defines paths, boot text, and fallbacks.
- `assets/js/data-loader.js` loads and normalizes JSON.
- `assets/js/ui.js` renders homepage UI modules.
- `assets/js/scanner.js` runs the simulated Host Scanner.
- `assets/js/live-terminal.js` streams activity and passive terminal lines.
- `assets/js/terminal.js` owns the Laboratory Console command registry.
- `assets/js/logs-page.js` renders the `/logs/` archive.
- `assets/js/evolution-page.js` renders `/evolution/` from `data/evolution.json`.
- `research/assets/js/research.js` renders `/research/` from `research/backend/cache/feed.json`.
- `assets/js/interactions.js` adds pointer-reactive glow effects.

## How To Add A New Log

1. Open `data/logs.json`.
2. Add a new object with the full log schema.
3. Use a new `id` and `logNumber`.
4. Set `featured: true` if it should appear on the homepage.
5. Set older featured logs to `false` when needed.

The homepage, archive page, and console `logs` command update automatically.

## How To Add New Activity

Add an object to `data/activity.json`:

```json
{
  "time": "02:18",
  "title": "Genesis specimen archived"
}
```

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
- Change provider settings in `research/backend/config/provider.json`.
- Keep provider-specific logic inside `research/backend/providers/`.
- Never make the frontend depend on a provider.
- Refresh cache with `node research/backend/fetcher/index.js`.

## Future Modules

- Genesis Collection
- Specimen Database
- Host Rankings
- World Infection Map
- Scanner history
- Public build log timeline

## Production Rule

If a future update can be represented as data, put it in `data/`. Touch HTML only when creating a new module shell.
