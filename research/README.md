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
    "provider": "reader",
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
    "failures": []
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

The frontend is provider-agnostic. The fetcher tries providers in this order:

1. `playwright`
2. `reader`
3. `rss`
4. preserved `cache`
5. `sample`

`playwright` is the primary provider when Chromium is available. If X blocks anonymous browser access or Playwright cannot launch, the fetcher logs the reason and continues.

Playwright can run either anonymously or with an optional authenticated X session. Anonymous mode is free, but X may hide parts of a profile timeline. Authenticated mode is required when the Laboratory must observe every post from an account that X does not expose to logged-out visitors.

Supported GitHub Secrets:

- `X_AUTH_TOKEN`: X `auth_token` cookie value.
- `X_CT0`: X `ct0` cookie value.
- `X_COOKIES_JSON`: full browser cookie export as JSON.
- `X_COOKIE_HEADER`: raw cookie header, useful for temporary local testing.

Do not commit real cookies into the repository. Store them only as GitHub Secrets.

`reader` currently provides the most reliable free fallback by reading public `twitter.com` profile pages through an open reader endpoint.

`rss` tries Nitter, RSSHub, and TwitRSS bridges with short timeouts. These services are unstable by design, so failures are expected and logged.

`cache` prevents a failed provider run from erasing a working feed.

`sample` exists only for development safety. Sample observations are dropped automatically as soon as real provider data exists.

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
- fetch duration
- last update
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

## Deployment

The site remains static.

The GitHub Action `.github/workflows/research-fetch.yml` runs every 10 minutes, installs Node dependencies, installs Chromium for Playwright, updates `research/backend/cache/feed.json`, and commits cache changes when new observations are found.

Vercel then redeploys the static site from the updated repository.

## Failure Behavior

If a provider fails:

- The exact provider/account error is logged.
- The fetcher continues to the next provider.

If every real provider fails:

- The fetcher keeps the previous cache.
- If no cache exists, the sample provider generates 10 local development observations.
- The frontend shows `Research feed temporarily unavailable. Observation continues...` only if `feed.json` cannot load at all.
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
