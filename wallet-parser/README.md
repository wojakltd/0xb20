# 0XB20 Wallet Parser

Wallet Parser is Experiment #002 inside the 0XB20 Laboratory Web3 tool layer.

It is a protected, read-only Base utility for extracting useful ERC-20 holder wallet addresses from a token contract.

## Purpose

The V1 goal is practical holder extraction, not perfect blockchain indexing.

User flow:

1. Paste a Base ERC-20 token contract.
2. Read token metadata.
3. Load the first indexed holders.
4. Filter duplicate/burn/null addresses.
5. Copy raw wallet addresses for use in other tools.

## Current Provider

V1 uses `BlockscoutProvider`.

Blockscout was selected because it provides:

- Free public Base token metadata.
- Free public token holder endpoints.
- Indexed holder balances without reconstructing every `Transfer` log.
- Contract labels such as `is_contract` when available.
- Fast enough response times for a browser-only protected experiment.

This is a practical choice for V1. It avoids the high RPC cost and failure risk of scanning historical token logs in the browser.

## Provider Interface

The UI does not call Blockscout directly.

All scanner UI talks to `WalletHolderScanner`, which talks to a provider implementing the `BaseProvider` contract.

Provider contract:

```js
{
  id: string,
  label: string,
  network: string,
  maxHolders: number,
  scanToken(address, options): Promise<{
    token: {
      address,
      name,
      symbol,
      decimals,
      totalSupplyRaw,
      totalSupply,
      holdersCount,
      type
    },
    holders: [{
      rank,
      address,
      valueRaw,
      balance,
      percentage,
      isContract,
      label
    }],
    meta: {
      provider,
      providerId,
      network,
      durationMs,
      lastUpdated,
      moreAvailable,
      rawHolderCount
    }
  }>
}
```

## How To Add A Future Provider

Create a new file under `wallet-parser/assets/js/`.

Example:

```js
class BaseScanProvider extends BaseProvider {
  async scanToken(address, options) {
    return {
      token,
      holders,
      meta
    };
  }
}
```

Then replace the provider construction in `wallet-parser/assets/js/wallet-parser.js`.

The UI should not need to change.

Future provider candidates:

- BaseScan
- Moralis
- Bitquery
- Internal indexer
- Transfer log reconstruction

## Filtering Rules

V1 only applies safe filtering:

- Invalid addresses are rejected.
- Zero address is rejected.
- Dead/burn/null addresses are rejected.
- Duplicate addresses are rejected.
- Zero-balance entries are rejected.

Smart contracts are not removed automatically. They are visually labeled when the provider marks them as contracts because legitimate holders can be contracts.

## Copy Format

Copy tools return only raw wallet addresses.

Format:

```txt
0x...
0x...
0x...
```

No balances, ranks, commas, JSON, or formatting are included.

This output is intentionally compatible with Token Sender.

## Security

Wallet Parser is read-only.

It does not:

- Connect a wallet.
- Request signatures.
- Request approvals.
- Send transactions.
- Store secrets.
- Expose API keys.

The page is protected with the existing `B20AccessGate` mechanism.

## Known V1 Limitations

- Only the first 100 indexed holders are displayed.
- Pagination UI is intentionally not implemented yet.
- Results depend on Blockscout index freshness.
- Browser-only scanning depends on public endpoint availability and CORS.
- Estimated holder count is only available when the provider exposes it.

## Future Expansion

The module is structured for:

- Pagination
- TXT download
- CSV export
- Balance filters
- Excluding LP/router/burn/CEX wallets
- Wallet labels
- Activity score
- Wallet quality score
- API mode
- Internal indexer fallback
