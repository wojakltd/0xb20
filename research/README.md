# 0XB20 Research

Research is the first useful Laboratory instrument.

It observes selected Base ecosystem accounts and renders the latest cached observations in a terminal-style feed.

This is not a social network, not an X client, and not a news page. The frontend only reads a local JSON cache. It does not know, and should never know, which provider created that cache.

## Structure

- `index.html` is the Research page shell at `/research/`.
- `assets/css/research.css` contains page-specific styling.
- `assets/js/research.js` renders search, filters, infinite scroll, lazy media, and auto-refresh.
- `backend/config/accounts.json` is the source of truth for observed accounts.
- `backend/config/provider.json` defines provider order, scraper timeouts, and cache settings.
- `backend/providers/provider.js` is the provider registry.
- `backend/providers/laboratory.js` is the only Laboratory entry point.
- `backend/providers/xapi.js` talks to the official X API and normalizes Laboratory observations.
- `backend/providers/playwright.js` is the primary anonymous X scraper.
- `backend/providers/reader.js` is the free open-reader fallback for public `twitter.com` profile pages.
- `backend/providers/rss.js` is the RSS/Nitter bridge fallback.
- `backend/providers/parser.js` normalizes RSS/Atom entries into Research posts.
- `backend/providers/sample.js` generates development observations only when every real source fails and no cache exists.
- `backend/providers/normalizer.js` keeps every provider on one feed schema.
- `backend/providers/future_api.js` is the placeholder for a paid or private provider.
- `backend/fetcher/index.js` updates `backend/cache/feed.json`.
- `backend/cache/feed.json` is the public cache consumed by the frontend.

## Feed Format

The frontend only fetches:

```txt
research/backend/cache/feed.json
```

The cache is an object. The old array-only format is still supported by the frontend for compatibility.

```json
{
  "metadata": {
    "version": 2,
    "provider": "laboratory+reader",
    "backendProvider": "laboratory+reader",
    "generatedAt": "2026-07-15T02:05:03.598Z",
    "durationMs": 99322,
    "accounts": 36,
    "accountsScanned": 36,
    "posts": 299,
    "postsCollected": 289,
    "latestObservationAt": "2026-07-14T19:27:31.886Z",
    "refreshIntervalMinutes": 10,
    "networks": ["BASE"],
    "categories": ["laboratory", "official"],
    "failures": [],
    "laboratory": {
      "provider": "xapi",
      "apiStatus": "online",
      "lastSyncAt": "2026-07-15T00:00:00.000Z",
      "nextSyncAt": "2026-07-15T12:00:00.000Z",
      "importedPosts": 12
    }
  },
  "posts": []
}
```

Every post supports:

```json
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
  "relative_time": "4h ago",
  "images": [],
  "video": "",
  "post_url": "https://x.com/base/status/...",
  "url": "https://x.com/base/status/...",
  "likes": 0,
  "replies": 0,
  "reposts": 0,
  "category": "official",
  "network": "BASE",
  "partner": false,
  "partner_label": "",
  "priority": 0,
  "favorite": false,
  "source": "reader"
}
```

Laboratory posts receive a small time-window priority boost during sorting. They are not pinned permanently.

Post timestamps are derived from X Snowflake status IDs whenever possible. Text dates from free readers are treated as hints only, because they may be localized, incomplete, or stale.

Freshness policy:

- Global feed keeps only posts newer than `maxPostAgeDays` in `backend/config/provider.json`.
- Accounts can define `minCreatedAt` and `minPostId`.
- The Laboratory account starts at `0xb20lol/status/2076659510803079325`.
- Previous cache entries are re-filtered on every fetch, so stale posts cannot survive inside `feed.json`.

## Provider Chain

The frontend is provider-agnostic. It only reads `backend/cache/feed.json`.

Laboratory has its own provider branch:

1. `laboratory`
2. `xapi` internally, behind `laboratory.js`

Everything else uses the ecosystem branch:

1. `playwright`
2. `reader`
3. `rss`
4. preserved `cache`
5. `sample`

`laboratory.js` is intentionally the only file that knows the Laboratory source. Today it calls `xapi.js`; later it can call a database, mirror, paid API, custom backend, or any other source without frontend changes.

`xapi.js` uses the official X API:

- `GET /2/users/by/username/{username}` to resolve `@0xb20lol`.
- `GET /2/users/{id}/tweets` to import posts, media, public metrics, and original post URLs.
- `start_time` from `minCreatedAt` on first official sync.
- `since_id` from the newest cached Laboratory post after the first official sync.

The Laboratory account is synced every 2 hours by default to keep the public journal fresh without wasting API quota. The GitHub Action can still run every 10 minutes for ecosystem updates; `laboratory.js` skips API calls until the Laboratory sync window opens.

`playwright` is the primary provider when Chromium is available. If X blocks anonymous browser access or Playwright cannot launch, the fetcher logs the reason and continues.

Playwright can run either anonymously or with an optional authenticated X session. Anonymous mode is free, but X may hide parts of a profile timeline. Authenticated mode is required when the Laboratory must observe every post from an account that X does not expose to logged-out visitors.

Supported GitHub Secrets:

- `X_BEARER_TOKEN`: official X API bearer token for the Laboratory provider.
- `X_API_BEARER_TOKEN`: alias for the same bearer token.
- `X_AUTH_TOKEN`: X `auth_token` cookie value.
- `X_CT0`: X `ct0` cookie value.
- `X_COOKIES_JSON`: full browser cookie export as JSON.
- `X_COOKIE_HEADER`: raw cookie header, useful for temporary local testing.

Do not commit real tokens or cookies into the repository. Store production values only as GitHub Secrets. Store local values only in `.env.local`, which is ignored.

`reader` currently provides the most reliable free fallback by reading public `twitter.com` profile pages through an open reader endpoint.

`rss` tries Nitter, RSSHub, and TwitRSS bridges with short timeouts. These services are unstable by design, so failures are expected and logged.

`cache` prevents a failed provider run from erasing a working feed.

`sample` exists only for development safety. Sample observations are dropped automatically as soon as real provider data exists.

## Laboratory Source

The official Laboratory journal is `@0xb20lol`.

Rules:

- Only posts from `2026-07-13T13:26:00.000Z` onward are valid.
- Older posts must never enter `feed.json`.
- Manual Terminal Logs are legacy records only.
- Future Laboratory history should be published on X first, then imported through the Laboratory provider.

The current canonical start post is `2076659510803079325`.

## Replace Provider

1. Create a new file in `backend/providers/`.
2. Export:

```js
async function fetchPosts(accounts, context) {
  return {
    posts: [],
    errors: []
  };
}
```

3. Register it in `backend/providers/provider.js`.
4. Add its name to `providerOrder` in `backend/config/provider.json`.

No frontend changes are required.

## Add Accounts

Edit `backend/config/accounts.json`.

```json
{
  "username": "base",
  "category": "official",
  "network": "BASE",
  "partner": false,
  "partnerName": "",
  "priority": 0,
  "favorite": false,
  "hidden": false,
  "description": "",
  "website": "",
  "logo": "",
  "minCreatedAt": "",
  "minPostId": "",
  "scrapePaths": []
}
```

`scrapePaths` is optional and used only by Playwright. The Laboratory account uses `["", "with_replies", "media"]` so authenticated collection can observe the main profile, replies, and media tabs from the canonical July 13 start point.

Supported categories today:

- `laboratory`
- `official`
- `team`
- `community`
- `builders`
- `protocols`
- `funds`
- `partners`

More categories can be added without changing the renderer.

Supported networks are plain strings. Current data uses `BASE`, but the model is ready for `ETHEREUM`, `SOLANA`, `ARBITRUM`, `OPTIMISM`, and `BITCOIN`.

## Debug Mode

Open `/research/?debug=1` to show cache diagnostics:

- provider
- current Laboratory provider
- current backend provider
- fetch duration
- last update
- last Laboratory sync
- API status
- imported Laboratory posts
- provider failures
- accounts scanned
- posts collected
- cache age

Debug output is hidden during normal usage.

## Run Fetcher

One-time fetch:

```bash
cd research/backend
npm ci
npm run fetch
```

Install Chromium locally only when testing the Playwright provider:

```bash
cd research/backend
npm run install-browsers
```

Continuous local watcher:

```bash
cd research/backend
npm run watch
```

The watcher uses `refreshIntervalMinutes` from `backend/config/provider.json`.

Local X API credentials:

```bash
X_BEARER_TOKEN="..."
X_API_BEARER_TOKEN="..."
```

Both may point to the same bearer token. `.env.local` is ignored and must never be committed.

## Deployment

The site remains static.

The GitHub Action `.github/workflows/research-fetch.yml` runs every 10 minutes, installs Node dependencies, installs Chromium for Playwright, updates `research/backend/cache/feed.json`, and commits cache changes when new observations are found.

The Laboratory provider internally syncs every 2 hours by default, even though the workflow runs more often for ecosystem freshness. Manual workflow runs can force a Laboratory X API sync immediately.

When `VERCEL_DEPLOY_HOOK_URL` is configured, the Research workflow triggers a Vercel production deploy immediately after pushing an updated cache.

## Failure Behavior

If a provider fails:

- The exact provider/account error is logged.
- The fetcher continues to the next provider.

If every real provider fails:

- The fetcher keeps the previous cache.
- If no cache exists, the sample provider generates 10 local development observations.
- The frontend shows `Research observations temporarily unavailable. Observation continues...` only if `feed.json` cannot load at all.
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
