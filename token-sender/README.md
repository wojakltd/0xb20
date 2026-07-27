# 0XB20 Token Sender

`/token-sender/` is the first premium Web3 application built on top of the shared Laboratory wallet layer.

It is intentionally conservative. The page can connect wallets, read ERC-20 metadata, parse recipients, build a validated preview, request exact approval and send through the configured sender contract. Premium capabilities are exposed through the existing Lab Pass system only; Token Sender does not own licensing logic.

## Access

The page reuses `assets/js/access-gate.js`.

Current password:

```text
0xb20.lol
```

It consumes the same shared wallet layer as `/profile/`, so the connected wallet identity stays consistent across Web3 instruments.

## Wallet Layer

The page does not own wallet state.

It consumes:

```text
assets/js/wallet-service.js
```

The shared service handles:

- wallet discovery
- WalletConnect adapter initialization
- persistent wallet session restore
- address, chain, balance and profile reads
- Base network switching
- exact ERC-20 approval transaction requests

## Configuration

Runtime configuration lives in:

```text
data/web3-tools.json
```

To activate transactions later, set:

```json
{
  "tokenSender": {
    "contractAddress": "0x..."
  }
}
```

The contract is expected to expose:

```solidity
send(address token, address[] recipients, uint256[] amounts)
```

Reference contract:

```text
contracts/B20TokenSender.sol
```

Deployment instructions:

```text
contracts/README.md
```

## Premium Edition

Token Sender uses the same Premium Core as Wallet Parser. It calls `B20Premium.requireAccess(...)` for premium capabilities and never implements payment, subscription or license verification itself.

Current feature gates are configured in `data/web3-tools.json`:

- `tokenSenderUnlimitedBatch` — remove the 250-wallet UI limit by splitting into safe sequential batches.
- `tokenSenderImport` — TXT and CSV recipient imports.
- `tokenSenderAddressBook` — local saved recipient lists.
- `tokenSenderRetryFailed` — retry/export failed recipient batches.
- `tokenSenderHistory` — local transaction memory.

The global Lab Pass is still verified on-chain by Premium Core.

## Batch Engine

The sender separates validation, batching and execution:

- `sender-import.js` parses TXT/CSV/address lists and removes duplicates.
- `sender-batcher.js` splits recipients into safe blockchain batches.
- `sender-progress.js` renders live batch progress.
- `sender-history.js` stores local transaction history.
- `sender-addressbook.js` stores reusable recipient lists.
- `sender-export.js` exports failed recipients.
- `sender-session.js` restores token, amount and recipient input after refresh.
- `sender-storage.js` provides shared storage, including Wallet Parser handoff.

User flow remains strict:

```text
Connect
↓
Read Token
↓
Validate Preview
↓
Approve Exact Amount
↓
Send Sequential Batches
```

Successful batches are never resent during retry. Failed recipients can be exported or retried separately.

## Recipient Input

Simple mode:

```text
Amount Per Wallet: 100

0x1111111111111111111111111111111111111111
0x2222222222222222222222222222222222222222
```

Advanced mode:

```text
0x1111111111111111111111111111111111111111,100
0x2222222222222222222222222222222222222222,50
```

Advanced line amounts override the default amount.

CSV import accepts common headers:

```text
wallet,amount
address,amount
recipient,amount
```

Wallet Parser can transfer currently filtered loaded holders directly into Token Sender through shared browser storage. No copy/paste is required.

## Security Rules

- No private keys are stored.
- No seed phrases are requested.
- No transaction is sent automatically.
- Approval is disabled until preview succeeds.
- Approval is exact-amount only.
- Sending requires explicit wallet confirmation for every batch.
- Unlimited sending is implemented as sequential safe batches, not a single unsafe transaction.

## Future Extensions

- audited batch sender contract
- gas estimation through the contract adapter
- NFT sender
- wallet scanner
- portfolio reader
- token-gated research profiles

Research never ends.
