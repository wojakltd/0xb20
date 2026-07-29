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

LaboratoryLicenseManager
  LicensePurchased / LicenseExtended events
        ↓
Referral Purchase Sync
  src/referral/license-indexer.js
        ↓
POST /api/referral/purchase logic
        ↓
Reward Engine
```

The frontend never owns referral business rules. Percentages, minimum withdrawal amounts and rank thresholds come from the backend response.

## Files

- `assets/js/referral-capture.js` — captures `?ref=` and stores it once.
- `src/referral/referral-service.js` — backend referral service and dashboard model.
- `src/referral/license-indexer.js` — reads Lab Pass purchase events from Base and records verified purchases.
- `api/referral/*.js` — Vercel API routes.
- `.github/workflows/referral-sync.yml` — scheduled GitHub Actions worker for purchase synchronization.
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
- `POST /api/referral/bind`
- `POST /api/referral/purchase`
- `POST /api/referral/sync-purchases`

`/api/referral/dashboard` is the preferred frontend endpoint because it returns the full Profile dashboard model in one request.

`/api/referral/purchase` is reserved for a trusted backend worker or manual admin tooling. It requires the `REFERRAL_ADMIN_SECRET` server environment variable and the `x-referral-admin-secret` request header. Browsers should never call it.

`/api/referral/bind` safely binds a captured referral wallet to a connected user wallet before purchase. It preserves first-touch attribution, rejects self-referrals, and never overwrites an existing referrer.

`/api/referral/sync-purchases` is the trusted watcher endpoint. It reads `LaboratoryLicenseManager` events from Base, stores sync progress in the referral database, and records each unique Lab Pass purchase through the same purchase ingestion path.

## Purchase Sync

Lab Pass purchases are indexed automatically by `src/referral/license-indexer.js`.

Flow:

1. Visitor arrives with `?ref=0xPartner`.
2. Browser stores the referrer locally.
3. Before Lab Pass purchase, Premium Core binds the referrer through `/api/referral/bind`.
4. `LaboratoryLicenseManager` emits `LicensePurchased` or `LicenseExtended`.
5. Scheduled sync calls `/api/referral/sync-purchases`.
6. The indexer reads Base logs, deduplicates by transaction hash, and records the purchase.
7. The reward engine credits level 1 / 2 / 3 partner balances.

The watcher does not change `LaboratoryLicenseManager`. The license contract remains responsible only for selling and extending Lab Pass.

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
2. Configure `REFERRAL_ADMIN_SECRET` in both Vercel and GitHub Actions.
3. Optionally configure `BASE_RPC_URL` for a more reliable Base RPC provider.
4. Confirm `.github/workflows/referral-sync.yml` is succeeding on schedule.
5. Add owner payout tooling for pending withdrawals.
6. Consider EIP-712 signed withdrawals for a later trust-minimized version.

Research never ends.
