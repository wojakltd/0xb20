# 0XB20 Profile Module

`/profile/` is the Laboratory wallet profile terminal for Web3 identity, Lab Pass status and signature experiments.

`/test/` is preserved as a legacy redirect, and `test/assets/` remains the shared visual/runtime asset folder for current Web3 tools.

It is intentionally separate from the production Research, AI LAB, Archive, Evolution and homepage modules.

## What It Does

- Reuses the shared `assets/js/access-gate.js` password mechanism.
- Consumes the shared global wallet service in `assets/js/wallet-service.js`.
- Connects browser wallets through EIP-6963 and EIP-1193 injected providers.
- Supports MetaMask, Coinbase Wallet, Rabby, Rainbow and other injected wallets when installed.
- Keeps a WalletConnect adapter slot ready, but direct QR connection requires a public WalletConnect project id.
- Reads wallet identity, network and ETH balance.
- Attempts best-effort ENS/Base Name discovery through a public profile resolver.
- Runs a client-side signature demo with `personal_sign`.

## Security Rules

This module never calls:

- `approve`
- `permit`
- `transfer`
- `eth_sendTransaction`

Allowed wallet methods:

- `eth_requestAccounts`
- `eth_accounts`
- `eth_chainId`
- `eth_getBalance`
- `personal_sign`

## Architecture

- `index.html` — route shell and Laboratory UI.
- `assets/css/test.css` — isolated visual layer matching the existing site.
- `assets/js/test-wallet.js` — Profile UI adapter for the global wallet service.
- `../assets/js/wallet-service.js` — shared wallet runtime used by all future Web3 tools.
- `src/wallet-contracts.ts` — TypeScript contracts for future Web3 experiments.

The public website remains static. No new build pipeline is required.

## Why No Wagmi/RainbowKit Runtime Yet

Wagmi and RainbowKit are React-first tools and require a bundler/build pipeline.

The current 0XB20 site is static HTML/CSS/JavaScript. Adding a React build step only for an internal sandbox would increase deployment complexity and risk the public site.

The current implementation uses the lower-level wallet standards those libraries depend on:

- EIP-6963 for wallet discovery.
- EIP-1193 for wallet requests.

If the sandbox graduates into a full Web3 application, the connector layer can be replaced with Wagmi/RainbowKit/Reown without changing the page concept.

## WalletConnect

WalletConnect QR support needs a public project id.

To enable it later:

1. Create a WalletConnect/Reown project.
2. Put the public project id into `walletConnectProjectId` in `assets/js/test-wallet.js`.
3. Test `/profile/` and `/token-sender/` with a mobile wallet.

## Future Experiments

- Token Sender
- Wallet Scanner
- AI Personalization
- Token Gating
- NFT Scanner
- Research Profiles

Research never ends.
