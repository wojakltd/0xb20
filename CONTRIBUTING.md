# Contributing to 0XB20 Laboratory

0XB20 Laboratory is an evolving Web3 laboratory, not a generic token landing page. Contributions should preserve the terminal-like Laboratory identity while improving reliability, clarity, and safety.

## Development Rules

- Keep the stack lightweight: static HTML, CSS, vanilla JavaScript, small serverless routes where required.
- Do not introduce frameworks unless there is a strong technical reason.
- Do not redesign the visual identity without an explicit design task.
- Keep data-driven systems data-driven.
- Never commit secrets, local environment files, cookies, private keys, or wallet credentials.
- Avoid fake hype, artificial urgency, price language, or roadmap promises.

## Local Development

Use a local static server so JSON files load correctly:

```bash
python -m http.server 4173
```

Research backend:

```bash
cd research/backend
npm ci
npm run fetch
```

AI Lab local serverless development requires Vercel with local environment variables:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
AI_RATE_LIMIT_PER_MINUTE=8
AI_RATE_LIMIT_PER_DAY=120
```

## Pull Requests

Before opening a pull request:

- Run syntax checks for changed JavaScript.
- Validate changed JSON.
- Confirm no `.env*` files are tracked.
- Explain why the change belongs inside the Laboratory universe.
- Include screenshots for UI changes.

## Suggested Labels

Recommended GitHub labels:

- `good first issue`
- `help wanted`
- `security`
- `research`
- `wallet`
- `frontend`
- `documentation`

## Code Review Expectations

Reviewers should verify:

- No secrets are exposed.
- No hidden wallet actions were added.
- No unnecessary dependency was introduced.
- Public copy remains honest and non-promotional.
- Existing pages still work through direct routes such as `/research/` and `/research/index.html`.
