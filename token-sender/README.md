# 0XB20 Asset Sender

`/token-sender/` is the Laboratory asset distribution instrument on Base.

The route stays `/token-sender/` for backward compatibility, but the product is now **Asset Sender**. The module supports the existing ERC-20 workflow and introduces an adapter foundation for ERC-721 and ERC-1155 transfers.

## Core Principle

Asset Sender does not own wallet state, licensing, or chain-specific standards directly.

It consumes shared layers:

- `assets/js/wallet-service.js` for wallet state, Base switching and wallet-confirmed transactions.
- `premium/premium-core.js` for Lab Pass feature checks.
- `data/web3-tools.json` for public contract configuration.
- `sender-adapters.js` for asset-standard behavior.

## Asset Adapter Architecture

The frontend uses one adapter interface:

```text
detect()
readMetadata()
parseRecipients()
validateRecipients()
describeRecipient()
buildBatches()
approveIfNeeded()
buildTransferTransaction()
```

Current adapters:

- `ERC20Adapter` — preserves the existing exact-approval ERC-20 batch sender flow.
- `ERC721Adapter` — supports manual NFT token ID assignment and safe transfer calls.
- `ERC1155Adapter` — supports `address,id,amount` transfer rows and safe transfer calls.

UI code must not call ERC-721 or ERC-1155 selectors directly. Standard-specific logic belongs in adapters.

## Automatic Detection

When a contract address is entered, Asset Sender attempts:

1. ERC-165 `supportsInterface(0x80ac58cd)` for ERC-721.
2. ERC-165 `supportsInterface(0xd9b67a26)` for ERC-1155.
3. ERC-20 metadata fallback.

If metadata fails, the UI reports a readable error instead of sending anything.

## ERC-20 Compatibility

The original ERC-20 workflow remains unchanged:

```text
Connect
↓
Detect Asset
↓
Validate Preview
↓
Approve Exact Amount
↓
Send Sequential Batches
```

Current ERC-20 execution contract:

```text
contracts/B20TokenSender.sol
```

Configured under:

```text
data/web3-tools.json → tokenSender.contractAddress
```

## Asset Sender V2 Contract

The new reference contract is:

```text
contracts/B20AssetSenderV2.sol
```

It is stateless and supports:

- `batchERC20`
- `batchERC721`
- `batchERC1155`

The contract has:

- no owner
- no upgradeability
- no fees
- no custody
- no withdrawal path
- native ETH rejection
- reentrancy protection
- custom errors
- separate events per asset type

Configured under:

```text
data/web3-tools.json → assetSender.contractAddress
```

If V2 is not configured, ERC-721 and ERC-1155 adapters can still use direct wallet-confirmed `safeTransferFrom` calls one batch at a time.

## Recipient Formats

ERC-20:

```text
0x1111111111111111111111111111111111111111
0x2222222222222222222222222222222222222222,50
```

ERC-721:

```text
0x1111111111111111111111111111111111111111,101
0x2222222222222222222222222222222222222222,102
```

or paste one recipient per line and put matching token IDs in the Token IDs field.

ERC-1155:

```text
0x1111111111111111111111111111111111111111,7,1
0x2222222222222222222222222222222222222222,7,2
```

## Premium Features

Asset Sender uses the same Lab Pass system as Wallet Parser. It calls existing Premium Core feature checks and never implements payment or license validation itself.

Current feature gates remain under `tokenSender*` keys for backward compatibility:

- unlimited safe batching
- TXT/CSV imports
- address books
- retry failed batches
- transaction history

## Wallet Parser Handoff

Wallet Parser sends parsed holder addresses through shared browser storage. The storage key remains legacy-compatible, while the visible tool name is Asset Sender.

## Security Rules

- No private keys are stored.
- No seed phrases are requested.
- No transaction is sent automatically.
- ERC-20 approvals are exact-amount only.
- NFT approvals are never hidden.
- Sending requires explicit wallet confirmation for every batch.
- Failed batches can be retried without resending successful batches.

## Known V2 Limitations

- ERC-721 owned token ID discovery requires an indexer for collections without enumerable methods. V2 supports manual token ID input.
- NFT image metadata is best-effort and must never block transfers.
- ERC-721 and ERC-1155 direct mode may require more wallet confirmations until the V2 sender contract is deployed and configured.

Research never ends.
