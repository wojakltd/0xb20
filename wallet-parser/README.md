# 0XB20 Wallet Parser

Wallet Parser is Experiment #002 inside the 0XB20 Laboratory Web3 tool layer.

It is a protected, read-only Base utility for extracting useful ERC-20 holder wallet addresses from a token contract.

## Purpose

The V1 goal is practical holder extraction, not perfect blockchain indexing.

User flow:

1. Paste a Base ERC-20 token contract.
2. Read token metadata.
3. Load indexed holders in cached pages.
4. Filter duplicate/burn/null addresses.
5. Sort, search, export all available provider holders or copy the current visible page for use in other tools.

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
      label,
      labels
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
  loadHolderPage(address, token, pageParams, options): Promise<{
    holders,
    meta
  }>,
  loadAllHolderPages(address, token, pageParams, knownHolders, options): Promise<{
    holders,
    meta
  }>,
  addressUrl(address): string
}
```

`scanToken()` validates the contract, reads token metadata and returns the first holder batch.

`loadHolderPage()` loads the next holder batch using the provider cursor returned in `meta.nextPageParams`.

`loadAllHolderPages()` is used by global exports. It walks every available provider cursor, reuses cached pages, retries transient failures, removes duplicates and returns any additional holders that were not already loaded.

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
- Duplicate addresses are rejected.
- Zero-balance entries are rejected.
- Zero/dead/burn/null addresses are labeled and hidden by default.

Smart contracts are not removed automatically. They are visually labeled when the provider marks them as contracts because legitimate holders can be contracts.

## Holder Labels

Each holder supports multiple labels through `parser-labels.js`.

Implemented labels:

- `CONTRACT`
- `BURN`

Reserved labels for later provider improvements:

- `LP`
- `ROUTER`
- `BRIDGE`
- `SAFE`
- `CEX`
- `UNKNOWN`

Filtering uses labels instead of destructive removal, so the original loaded dataset stays intact.

## Pagination

Wallet Parser caches every loaded provider page in memory.

The UI can move backward through already loaded holders without making another provider request. New requests are only made when the user reaches the end of the loaded dataset and the provider reports more holders.

V1 loads 100 useful holders per application page. Blockscout currently allows a maximum `items_count` of 50 per API request, so `BlockscoutProvider` internally performs two indexed requests per Wallet Parser page when needed.

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

## Export Format

TXT and CSV exports are global provider exports.

When the user starts an export, Wallet Parser:

1. Reuses all holder pages already cached in the browser.
2. Automatically requests every remaining page currently available from the provider.
3. Merges all loaded holders.
4. Removes duplicate addresses.
5. Applies the active filters, search and sorting.
6. Generates the file from the final visible result.

This exports all available holders from the current provider. It does not promise mathematical completeness if the provider limits depth, becomes unavailable, rate-limits the browser or has stale index data.

TXT export downloads one filtered wallet address per line.

CSV export downloads:

- Rank
- Address
- Balance
- Supply percentage
- Labels

Both exports include only holders matching the current filters and search. Manual page browsing is separate from export scope.

During export the UI reports pages loaded, wallets loaded, wallets exported, duplicates removed, filtered out, elapsed time and provider. If the provider stops early, the tool exports the available data and displays a partial-export message.

## Advanced Filters

Filters are applied in memory and never mutate the original loaded holder dataset.

Current filters:

- Hide smart contracts
- Hide burn wallets
- Hide zero address
- Minimum balance
- Maximum balance
- Minimum supply percentage
- Maximum supply percentage
- Search address

Statistics update after filtering and display loaded, filtered, hidden, visible holders, current page and contract filter state.

## Sorting

Sorting is performed in memory on loaded holders only.

Available sort keys:

- Rank
- Balance
- Supply percentage

Sorting never triggers a provider reload.

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

- Holder availability depends on the current provider index.
- Very large tokens may require long exports because the browser must request multiple provider pages.
- Results depend on Blockscout index freshness.
- Browser-only scanning depends on public endpoint availability and CORS.
- Estimated holder count is only available when the provider exposes it.
- Global export is limited by provider availability, rate limits and the configured safety page cap.

## Future Expansion

The module is structured for:

- Premium Core access checks
- LP/router/bridge/CEX labels
- Wallet labels
- Activity score
- Wallet quality score
- API mode
- Internal indexer fallback
