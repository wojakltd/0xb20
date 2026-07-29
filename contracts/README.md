# B20 Sender Contracts

This folder contains the reviewed sender contracts used by `/token-sender/`.

## B20TokenSender

`B20TokenSender.sol` is the legacy ERC-20 execution layer expected by the original Asset Sender flow.

It is deliberately small:

- no owner
- no admin
- no fees
- no upgradeability
- no token custody
- no native ETH receive path
- no unlimited approval requirement
- MIT SPDX identifier
- NatSpec comments for public review

The frontend asks the wallet to approve only the exact total amount required by the validated recipient list.

## Contract Interface

```solidity
send(address token, address[] recipients, uint256[] amounts)
```

The contract transfers tokens from `msg.sender` directly to each recipient.
It cannot move tokens from another wallet because `transferFrom` always uses the caller as the source wallet.

## Deploy With Remix

1. Open `https://remix.ethereum.org`.
2. Create `B20TokenSender.sol`.
3. Paste `contracts/B20TokenSender.sol`.
4. Compile with Solidity `0.8.24` or newer.
5. Enable optimizer with `200` runs.
6. Connect wallet to Base mainnet.
7. Deploy `B20TokenSender`.
8. Copy the deployed contract address.
9. Verify the contract on BaseScan with the same compiler and optimizer settings.
10. Put the verified contract address into `data/web3-tools.json`:

```json
{
  "tokenSender": {
    "contractAddress": "0xDEPLOYED_CONTRACT"
  }
}
```

11. Commit and push the config update.

## Wallet Warning Notes

No engineer can guarantee that every wallet or block explorer will never show a generic warning for a newly deployed contract.

This implementation minimizes warnings by keeping the contract:

- verified
- immutable
- ownerless
- fee-free
- exact-approval based
- limited to direct ERC-20 `transferFrom` batch distribution

Do not add owner withdrawals, upgrade proxies, delegatecall, arbitrary executor functions, or unlimited approvals.

## Sender Flow

1. Connect wallet.
2. Read token.
3. Paste recipients.
4. Validate preview.
5. Approve exact total amount.
6. Send batch.

Research never ends.

---

# B20 Asset Sender V2

`B20AssetSenderV2.sol` is the universal Base asset sender reference contract.

It extends the sender model from ERC-20-only distribution into a single stateless contract for:

- ERC-20 token batches;
- ERC-721 NFT batches;
- ERC-1155 asset batches.

## Security Model

The V2 contract remains deliberately small:

- no owner;
- no admin;
- no fees;
- no upgradeability;
- no token custody;
- no withdrawal functions;
- no native ETH receive path;
- no delegatecall;
- custom errors;
- separate events per asset type;
- reentrancy protection.

Every transfer moves assets directly from `msg.sender` to recipients. The contract cannot move assets from wallets that did not approve or call it.

## Contract Interfaces

```solidity
batchERC20(address token, address[] recipients, uint256[] amounts)
batchERC721(address collection, address[] recipients, uint256[] tokenIds)
batchERC1155(address collection, address[] recipients, uint256[] ids, uint256[] amounts)
```

## Deploy With Remix

1. Open `https://remix.ethereum.org`.
2. Create `B20AssetSenderV2.sol`.
3. Paste `contracts/B20AssetSenderV2.sol`.
4. Compile with Solidity `0.8.24` or newer.
5. Enable optimizer with `200` runs.
6. Connect wallet to Base mainnet.
7. Deploy `B20AssetSenderV2`.
8. Copy the deployed contract address.
9. Verify the contract on BaseScan with the same compiler and optimizer settings.
10. Put the verified contract address into `data/web3-tools.json`:

```json
{
  "assetSender": {
    "contractAddress": "0xDEPLOYED_CONTRACT"
  }
}
```

The existing `tokenSender.contractAddress` should remain configured for ERC-20 backward compatibility until the frontend fully switches ERC-20 execution to V2.

## Wallet Warning Notes

The V2 contract avoids admin controls and custody. Wallets may still show generic warnings for newly deployed contracts, especially for NFT approvals. Users must manually confirm every approval and transfer.

---

# Laboratory License Manager

`LaboratoryLicenseManager.sol` is the shared Lab Pass contract for Premium Core.

It is designed as one reusable licensing contract for every Laboratory tool:

- Wallet Parser
- Asset Sender
- AI LAB
- Research
- future experiments

## Responsibilities

- accept native ETH payments in V1;
- support ERC-20 payments later by switching `paymentToken`;
- issue one license per wallet;
- extend active licenses instead of resetting them;
- expose `isLicenseActive(address)`;
- expose `licenseExpiration(address)`;
- allow owner updates for price, payment token and license duration;
- allow pausing purchases and withdrawing collected funds.

The owner cannot arbitrarily grant or revoke licenses.

## Base V1 Deployment

Current deployed contract:

`0xe4a16552EF03C7933031e87161c8C572E50318D5`

Current source uses no constructor arguments. The initial deployment settings are embedded for easier Remix deployment:

- owner: `0xb9F5fB4E152ae5c261DfCdDb1D1124ACA37EF920`
- payment token: `0x0000000000000000000000000000000000000000`
- initial price: `5263157894736842`
- initial duration: `2592000`

This means roughly 0.005263 ETH for 30 days on Base, equal to about 10 USD when ETH is 1900 USD.

The verified contract address is configured in `data/web3-tools.json` under `premium.contractAddress`.
