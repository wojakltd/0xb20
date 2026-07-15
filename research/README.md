# 0XB20 Research

Research is the first useful Laboratory instrument.

It observes selected Base ecosystem accounts and renders the latest cached observations in a terminal-style feed.

This is not a social network, not an X client, and not a news page. The frontend only reads a local JSON cache. It does not know, and should never know, which provider created that cache.

## Structure

- `index.html` is the Research page shell at `/research/`.
- `assets/css/research.css` contains page-specific styling.
- `assets/js/research.js` renders search, filters, infinite scroll, lazy media, and auto-refresh.
- `backend/config/accounts.json` is the source of truth for observed accounts.
- `backend/config/provider.json` selects the active data provider and fetch settings.
- `backend/providers/provider.js` creates the active provider.
- `backend/providers/rss.js` is the current free RSS bridge provider.
- `backend/providers/parser.js` normalizes RSS/Atom entries into Research posts.
- `backend/providers/future_api.js` is the placeholder for a paid or private provider.
- `backend/fetcher/index.js` updates `backend/cache/feed.json`.
- `backend/cache/feed.json` is the public cache consumed by the frontend.

## Frontend Contract

The frontend only fetches:

```txt
research/backend/cache/feed.json
```

Every post supports:

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
  "network": "BASE",
  "partner": false,
  "partner_label": ""
}
```

## Current Provider

The MVP uses a free RSS bridge provider.

Default bridge order:

1. `rsshub.app`
2. `twitrss.me`

These are intentionally isolated behind `backend/providers/rss.js`. If an RSS bridge stops working, replace `bridgeTemplates` in `backend/config/provider.json` or create a new provider without changing the frontend.

## Replace Provider

1. Create a new file in `backend/providers/`.
2. Export:

```js
async function getLatestPosts({ accounts, config }) {
  return {
    posts: [],
    errors: []
  };
}
```

3. Register it in `backend/providers/provider.js`.
4. Change `activeProvider` in `backend/config/provider.json`.

No frontend changes are required.

## Add Accounts

Edit `backend/config/accounts.json`.

```json
{
  "username": "base",
  "category": "official",
  "network": "BASE"
}
```

Supported categories today:

- `official`
- `team`
- `community`
- `builders`
- `protocols`
- `funds`
- `partners`

More categories can be added without changing the renderer.

## Run Fetcher

One-time fetch:

```bash
cd research/backend
npm run fetch
```

Continuous local watcher:

```bash
cd research/backend
npm run watch
```

The watcher uses `refreshIntervalMinutes` from `backend/config/provider.json`.

## Deployment

The site remains static.

The GitHub Action `.github/workflows/research-fetch.yml` runs every 10 minutes, updates `research/backend/cache/feed.json`, and commits cache changes when new observations are found.

Vercel then redeploys the static site from the updated repository.

## Failure Behavior

If every provider fails:

- The fetcher keeps the previous cache.
- The frontend shows `Research feed temporarily unavailable. Observation continues...` only if no cached observations exist.
- The page never crashes.

## Future Expansion

The cache schema already supports:

- Multiple networks
- Partner badges
- Verified research subjects
- Media cards
- AI summaries
- Sentiment
- Keyword alerts
- GitHub releases
- Farcaster feeds
- Mirror articles
- RSS sources
