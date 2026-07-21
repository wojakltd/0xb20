# 0XB20 Token Sender

`/token-sender/` is the first protected Web3 application built on top of the shared Laboratory wallet layer.

It is intentionally conservative. The page can connect wallets, read ERC-20 metadata, parse recipients, build a validated preview, request exact approval and send through the configured sender contract.

## Access

The page reuses `assets/js/access-gate.js`.

Current password:

```text
0xb20.lol
```

It uses the same session key as `/test/`, so unlocking the Web3 sandbox unlocks this protected instrument for the current browser session.

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

## Security Rules

- No private keys are stored.
- No seed phrases are requested.
- No transaction is sent automatically.
- Approval is disabled until preview succeeds.
- Approval is exact-amount only.
- Sending is disabled until a real sender contract address is configured.

## Future Extensions

- audited batch sender contract
- gas estimation through the contract adapter
- NFT sender
- wallet scanner
- portfolio reader
- token-gated research profiles

Research never ends.
