# Security Policy

0XB20 Laboratory is an experimental public Web3 project. Security reports are treated as part of the Laboratory's public engineering discipline.

## Supported Versions

Only the current `main` branch is actively maintained.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older commits | No |

## Reporting a Vulnerability

Please do not publish exploitable details before maintainers have had time to respond.

Preferred flow:

1. Use GitHub Security Advisories if they are enabled for this repository.
2. If private advisories are unavailable, open a minimal GitHub issue requesting a private security contact. Do not include exploit details in the public issue.
3. Include affected files, impact, reproduction steps, and a suggested fix if possible.

## Scope

In scope:

- Leaked secrets or credentials.
- Wallet transaction safety issues.
- Hidden approvals or unintended token transfers.
- Serverless API abuse paths.
- XSS or unsafe rendering.
- GitHub Actions or deployment workflow risks.

Out of scope:

- Spam against public social accounts.
- Issues requiring compromised user wallets.
- Generic wallet warnings caused only by new contracts or new domains.

## Security Principles

- Never commit real credentials.
- Never store private keys, seed phrases, or wallet credentials.
- Keep third-party API keys server-side.
- Require explicit wallet confirmation for every transaction.
- Prefer exact approvals over unlimited approvals.
- Treat client-side password gates as UX barriers, not authentication.
