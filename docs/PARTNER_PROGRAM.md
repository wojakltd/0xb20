# 0XB20 Partner Program

The Partner Program is the ecosystem-level referral layer for 0XB20 Laboratory.

It does not replace `LaboratoryLicenseManager`.

`LaboratoryLicenseManager` remains responsible only for Lab Pass purchases, license extension and on-chain expiration reads. The referral system is built around it as an off-chain partner dashboard.

## Architecture

```text
Visitor URL
  ?ref=0xPartner
        ↓
Referral Capture
  localStorage pending referrer
        ↓
Wallet Connect
        ↓
Referral API
        ↓
Referral Service
        ↓
Referral Database
        ↓
Profile Partner Dashboard
```

The frontend never owns referral business rules. Percentages, minimum withdrawal amounts and rank thresholds come from the backend response.

## Files

- `assets/js/referral-capture.js` — captures `?ref=` and stores it once.
- `src/referral/referral-service.js` — backend referral service and dashboard model.
- `api/referral/*.js` — Vercel API routes.
- `profile/assets/js/profile-referral.js` — Profile dashboard client.
- `profile/assets/css/profile.css` — Profile dashboard layout.
- `contracts/LaboratoryReferralVault.sol` — payout vault contract.

## Referral Rules

Default backend configuration:

- Level 1: `35%`
- Level 2: `10%`
- Level 3: `5%`
- Minimum withdrawal: `20 USDC`

Rules:

- a referrer can only be assigned once;
- self-referrals are rejected;
- circular referral trees are rejected;
- referral data is ecosystem-wide, not per-tool;
- frontend never calculates commission percentages.

## Database

The service uses Neon Postgres when `DATABASE_URL` exists. This is the recommended production path because referral balances, purchases and withdrawals are accounting data and should live in a durable transactional database.

Environment variables:

```text
DATABASE_URL=
```

The backend automatically creates a simple `referral_records` JSONB table on first use.

Vercel KV / Upstash Redis remains supported as a fallback:

```text
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Fallback names are also supported:

```text
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

If no database variables exist, the service falls back to volatile serverless memory. This is safe for development but not persistent enough for production rewards.

## API

- `GET /api/referral/profile?wallet=0x...`
- `GET /api/referral/stats?wallet=0x...`
- `GET /api/referral/history?wallet=0x...`
- `GET /api/referral/link?wallet=0x...`
- `GET /api/referral/materials?wallet=0x...`
- `GET /api/referral/dashboard?wallet=0x...`
- `GET /api/referral/tree?wallet=0x...`
- `POST /api/referral/withdraw`
- `POST /api/referral/purchase`

`/api/referral/dashboard` is the preferred frontend endpoint because it returns the full Profile dashboard model in one request.

`/api/referral/purchase` is reserved for a trusted backend worker or manual admin tooling. It requires the `REFERRAL_ADMIN_SECRET` server environment variable and the `x-referral-admin-secret` request header. Browsers should never call it.

## Withdrawal Model

V1 does not send payouts automatically.

Flow:

1. Partner connects wallet.
2. Partner requests withdrawal.
3. Wallet signs a withdrawal request message.
4. Backend records a pending withdrawal.
5. Owner executes payout from the vault.

This prevents browser-side payout authority and keeps the payout container simple.

## Referral Vault

`LaboratoryReferralVault` stores payout funds only.

It does not know:

- referral percentages;
- partner trees;
- purchase sources;
- campaign bonuses.

It supports:

- `deposit(uint256 amount)`;
- `withdraw(address recipient, uint256 amount, bytes32 withdrawalId)`;
- `pause()`;
- `resume()`;
- `recoverTokens(IERC20 token, address recipient, uint256 amount)`.

Security properties:

- `Ownable2Step`;
- `Pausable`;
- `ReentrancyGuard`;
- `SafeERC20`;
- no arbitrary user withdrawals;
- no referral math on-chain.

## Production Notes

Before public revenue sharing:

1. Configure `DATABASE_URL` with a Neon pooled Postgres connection string.
2. Add a purchase-event indexer that watches `LaboratoryLicenseManager` events.
3. Send verified purchases into `/api/referral/purchase`.
4. Add owner payout tooling for pending withdrawals.
5. Consider EIP-712 signed withdrawals for a later trust-minimized version.

Research never ends.
