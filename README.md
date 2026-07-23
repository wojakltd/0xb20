# 0XB20 Laboratory

0XB20 Laboratory is an evolving Web3 laboratory built in public on Base.

It is not a generic token landing page. The project treats the website as an operating terminal: research, experiments, archive records, AI synthesis, wallet tools, and future Web3 instruments all live inside one lightweight Laboratory interface.

## Vision

0XB20 exists to document an experiment in public:

- build small systems openly;
- observe what happens;
- archive failures and progress;
- turn useful experiments into reusable tools;
- avoid fake hype, fake roadmaps, and artificial urgency.

Research never ends.

## Features

- Static Laboratory terminal built with HTML, CSS, and vanilla JavaScript.
- Research Terminal that renders ecosystem observations from a generated cache.
- AI Lab serverless instrument for multilingual idea synthesis and X-ready transmissions.
- Prototype Records archive rendered from JSON.
- Evolution Tree rendered from structured project data.
- Shared wallet layer for Web3 experiments.
- Test Zone for read-only wallet integration and signature testing.
- Token Sender v1 for exact-approval ERC-20 batch distribution through a verified sender contract.
- Wallet Parser v1 for read-only Base ERC-20 holder extraction, filtering and exports.
- Premium Core v1 foundation for one reusable on-chain Lab Pass across current and future tools.
- Vercel-compatible deployment and GitHub Actions research cache automation.

## Architecture

The project intentionally avoids frontend frameworks.

```text
Static shell
├─ index.html
├─ assets/css/*
├─ assets/js/*
├─ data/*.json
├─ logs/
├─ research/
├─ ai/
├─ test/
├─ token-sender/
├─ wallet-parser/
├─ evolution/
├─ api/ai/generate.ts
└─ research/backend/
```

Important source-of-truth files:

- `data/logs.json` — Prototype Records archive.
- `data/evolution.json` — Evolution Tree phases.
- `data/status.json` — homepage and status panels.
- `data/scanner.json` — simulated Host Scanner outcomes.
- `data/terminal-events.json` — Laboratory terminal events.
- `data/web3-tools.json` — public Web3 tool configuration.
- `research/backend/config/accounts.json` — Research accounts.
- `research/backend/cache/feed.json` — generated Research cache consumed by the frontend.

## Current Applications

### Home

The public control center for the Laboratory.

### Archive

Historical Prototype Records from the early development phase.

### Research

The live observation terminal. The frontend reads only `research/backend/cache/feed.json`.

### AI Lab

An idea synthesis instrument with language selection. The browser calls `/api/ai/generate`; the OpenAI key remains server-side only.

### Test Zone

Internal Web3 sandbox for wallet connection and signature experiments.

### Token Sender

Protected ERC-20 batch sender interface. It uses:

- shared wallet service;
- Base mainnet;
- exact approval only;
- preview before approval;
- explicit wallet confirmation for every transaction;
- verified sender contract configured in `data/web3-tools.json`.

### Wallet Parser

Protected read-only holder extraction instrument for Base ERC-20 tokens. It uses a provider abstraction, Blockscout API in V1, cached pagination, safe labels, filters, search, visible-page copy, and global TXT/CSV export for all holders available from the current provider.

Advanced Wallet Parser tools integrate with Premium Core through feature checks only. Licensing logic stays outside the parser.

### Premium Core

Shared Lab Pass layer for Laboratory tools. The frontend checks `LaboratoryLicenseManager` on-chain, requests exact USDC approval when needed, and never stores license access locally.

### Evolution

Visual research tree showing the Laboratory's current development phase.

## Roadmap

This is not a promise-based roadmap. It is a research direction.

- Wallet Scanner.
- NFT Sender.
- Research Profiles.
- Portfolio views.
- AI-assisted research summaries.
- Additional ecosystem feeds.
- Token-gated Laboratory experiments.

## Installation

Clone the repository:

```bash
git clone https://github.com/wojakltd/0xb20.git
cd 0xb20
```

Run the static site locally:

```bash
python -m http.server 4173
```

Open:

```text
http://localhost:4173/
```

## Development

Research backend:

```bash
cd research/backend
npm ci
npm run fetch
```

AI Lab local environment:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
AI_RATE_LIMIT_PER_MINUTE=8
AI_RATE_LIMIT_PER_DAY=120
```

Never commit `.env`, `.env.local`, cookies, bearer tokens, private keys, seed phrases, or wallet credentials.

## Deployment

The site is designed for Vercel.

Required production environment variables:

- `OPENAI_API_KEY` — server-side OpenAI key for AI Lab.
- `OPENAI_MODEL` — optional model override.
- `AI_RATE_LIMIT_PER_MINUTE` — optional per-IP throttle for AI Lab.
- `AI_RATE_LIMIT_PER_DAY` — optional per-IP daily budget guard for AI Lab.

GitHub Actions secrets used by automation:

- `VERCEL_DEPLOY_HOOK_URL` — Vercel Deploy Hook.
- `X_BEARER_TOKEN` or `X_API_BEARER_TOKEN` — X API bearer token for Laboratory Research import.

Optional temporary Research fallbacks:

- `X_AUTH_TOKEN`
- `X_CT0`
- `X_COOKIES_JSON`
- `X_COOKIE_HEADER`

Store these only as GitHub Secrets or local ignored `.env.local` values.

## WalletConnect / Reown Configuration

WalletConnect Project IDs are public identifiers, not private secrets. They still should be restricted in the Reown Dashboard.

Allowed domains should include only:

- `0xb20.lol`
- `www.0xb20.lol`
- Vercel preview domains used by maintainers, if needed
- `localhost` for local development, if needed

Do not leave unrestricted wildcard domains enabled for public release.

## Security Principles

- Third-party API keys stay server-side.
- Client-side password gates are UX barriers, not authentication.
- Wallet tools never request private keys or seed phrases.
- Token Sender uses exact approvals only.
- Premium Core uses on-chain license checks only.
- No hidden approvals.
- No automatic transaction execution.
- Users manually confirm every wallet action.
- Public contract configuration contains only public chain IDs and contract addresses.

Report vulnerabilities through `SECURITY.md`.

## Contributing

Read `CONTRIBUTING.md` before opening pull requests.

Useful contribution areas:

- documentation;
- accessibility;
- wallet safety;
- Research provider reliability;
- performance;
- test coverage;
- future Web3 instruments.

## License

Released under the MIT License. See `LICENSE`.
