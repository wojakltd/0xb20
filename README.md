# 0XB20 Laboratory

Static laboratory terminal for the 0XB20 public experiment.

## Structure

- `index.html` is the stable shell and should stay lightweight.
- `logs/index.html` is the fixed-height Laboratory Archive page.
- `research/index.html` is the Research observation terminal.
- `evolution/index.html` is the Laboratory Evolution Tree page.
- `protocol/index.html` redirects old links to Evolution.
- `data/logs.json` is the source of truth for Laboratory Logs.
- `data/evolution.json` drives the Evolution page.
- `research/backend/cache/feed.json` drives the Research feed.
- `data/activity.json` drives the Activity Feed.
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

Add a new Laboratory Log by appending an object to `data/logs.json`.
The homepage uses the first `featured: true` log, or the newest JSON entry if none is featured.

Update the Laboratory Evolution tree by editing `data/evolution.json`.
Future phases should be added to the `phases` array only.

Tune scanner outcomes in `data/scanner.json` and passive system events in
`data/terminal-events.json`.

Update Research accounts in `research/backend/config/accounts.json`.
Run `node research/backend/fetcher/index.js` to refresh `research/backend/cache/feed.json`.

Use a local static server for full JSON loading during development:

```bash
python -m http.server 4173
```
