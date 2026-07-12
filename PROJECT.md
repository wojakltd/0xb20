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
- No backend
- No frameworks
- No dependencies

HTML should define module shells only. Expandable content should come from `data/` whenever possible.

## Folder Structure

- `index.html` is the main Laboratory Operating System shell.
- `logs/index.html` is the Laboratory Archive page at `/logs/`.
- `style.css` is a compatibility stylesheet that imports modular CSS.
- `script.js` is the homepage bootstrapper.
- `assets/css/` contains design tokens, layout, components, and effects.
- `assets/js/` contains independent browser modules.
- `data/` contains the editable source of truth for live content.

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
- `assets/js/interactions.js` adds pointer-reactive glow effects.

## How To Add A New Log

1. Open `data/logs.json`.
2. Add a new object with the full log schema.
3. Use a new `id` and `logNumber`.
4. Set `featured: true` if it should appear on the homepage.
5. Set older featured logs to `false` when needed.

The homepage, archive page, search, filters, and console `logs` command update automatically.

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

## Future Modules

- Genesis Collection
- Specimen Database
- Host Rankings
- World Infection Map
- Scanner history
- Public build log timeline

## Production Rule

If a future update can be represented as data, put it in `data/`. Touch HTML only when creating a new module shell.
