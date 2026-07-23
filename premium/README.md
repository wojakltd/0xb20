# 0XB20 Premium Core

Premium Core is the shared Lab Pass licensing layer for 0XB20 Laboratory tools.

It is deliberately separate from applications. A tool should only ask:

```js
await window.B20Premium.requireAccess('featureId', 'Feature Label')
```

The tool must not implement pricing, payment, expiration, or license storage.

## Architecture

```text
Application Feature
  ↓
B20Premium.requireAccess(feature)
  ↓
Reusable Unlock Modal
  ↓
Shared Wallet Service
  ↓
LaboratoryLicenseManager
  ↓
On-chain license status
```

## Files

- `premium-core.js` loads config, checks license status, and exposes the public API.
- `premium-wallet.js` connects wallets and switches to Base through the shared wallet layer.
- `premium-contract.js` encodes contract calls, native ETH purchases, and optional exact ERC-20 approvals for future payment modes.
- `premium-modal.js` renders the reusable Unlock Laboratory modal.
- `premium-license.js` normalizes license state.
- `premium-utils.js` contains ABI encoding, formatting, and validation helpers.
- `premium.css` contains reusable Lab Pass UI styles.

## Contract

The on-chain contract is `contracts/LaboratoryLicenseManager.sol`.

V1 deployment settings for Base:

- `initialOwner`: project owner wallet.
- `initialPaymentToken`: `0x0000000000000000000000000000000000000000` for native ETH.
- `initialPrice`: `5263157894736842` for approximately 10 USD when ETH is 1900 USD.
- `initialDuration`: `2592000` for 30 days.

The owner can update price, payment token, duration, pause purchases, resume purchases, and withdraw collected funds.
The owner cannot arbitrarily grant or revoke licenses.

## Frontend Config

Set the deployed contract address in `data/web3-tools.json`:

```json
{
  "premium": {
    "contractAddress": "0xDEPLOYED_LAB_PASS_CONTRACT"
  }
}
```

Without a deployed contract address, protected features display a configuration error instead of attempting payment.

## Wallet Parser Integration

Wallet Parser currently gates:

- `walletParserGlobalExport`
- `walletParserUnlimitedPagination`
- `walletParserAdvancedFilters`

The parser contains no payment logic. It only calls Premium Core.

## Security Model

- Licenses are verified on-chain.
- Browser storage is never trusted for license state.
- V1 payment uses exact native ETH value for the configured price.
- ERC-20 payment mode is still supported by the contract/frontend for future migration.
- No private keys, seed phrases, API keys, backend database, or centralized license server are used.
- Every transaction requires explicit wallet confirmation.

## Future Expansion

Future tools can use the same module by adding feature IDs to `data/web3-tools.json` and calling `requireAccess`.

Future plans can extend the contract model with multiple durations, lifetime plans, referral rewards, NFT upgrades, or partner access.
