# 0XB20 Laboratory

Static laboratory terminal for the 0XB20 public experiment.

## Structure

- `index.html` is the stable shell and should stay lightweight.
- `logs/index.html` is the fixed-height Laboratory Archive page.
- `research/index.html` is the Research observation terminal.
- `evolution/index.html` is the Laboratory Evolution Tree page.
- `protocol/index.html` redirects old links to Evolution.
- `data/logs.json` is the source of truth for Prototype Records.
- `data/evolution.json` drives the Evolution page.
- `research/backend/cache/feed.json` drives the Research journal, status metadata, and homepage Activity Trace.
- `data/status.json` drives the System Status panel.
- `data/scanner.json` drives the simulated Host Scanner.
- `data/terminal-events.json` feeds the permanent Laboratory Terminal.
- `assets/css/` contains visual modules loaded directly by `index.html`.
- `assets/js/` contains small browser modules loaded before `script.js`.
- `assets/js/terminal.js` owns the Laboratory Console command registry.
- `assets/js/logs-page.js` renders the simple scrolling Laboratory Archive terminal.
- `assets/js/evolution-page.js` renders the Evolution tree from JSON.
- `research/assets/js/research.js` renders the Research observation feed from cache.
- `style.css` and `script.js` remain root compatibility entry points.

## Updating The Lab

Correct a Prototype Record by editing `data/logs.json`.
The homepage always displays the newest JSON entry as the latest archive record.

Update the Laboratory Evolution tree by editing `data/evolution.json`.
Future phases should be added to the `phases` array only.

Tune scanner outcomes in `data/scanner.json` and passive terminal events in
`data/terminal-events.json`. Homepage activity comes from Research cache metadata.

Update Research accounts in `research/backend/config/accounts.json`.
Run the provider chain to refresh `research/backend/cache/feed.json`:

```bash
cd research/backend
npm ci
npm run fetch
```

The Research frontend still downloads only `research/backend/cache/feed.json`.
Open `/research/?debug=1` to inspect provider/cache diagnostics during development.

Use a local static server for full JSON loading during development:

```bash
python -m http.server 4173
```
