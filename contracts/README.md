# B20 Token Sender Contract

This contract is the execution layer expected by `/token-sender/`.

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

# Laboratory License Manager

`LaboratoryLicenseManager.sol` is the shared Lab Pass contract for Premium Core.

It is designed as one reusable licensing contract for every Laboratory tool:

- Wallet Parser
- Token Sender
- AI LAB
- Research
- future experiments

## Responsibilities

- accept ERC-20 payments;
- issue one license per wallet;
- extend active licenses instead of resetting them;
- expose `isLicenseActive(address)`;
- expose `licenseExpiration(address)`;
- allow owner updates for price, payment token and license duration;
- allow pausing purchases and withdrawing collected funds.

The owner cannot arbitrarily grant or revoke licenses.

## Base V1 Constructor Arguments

```text
initialOwner:        owner wallet
initialPaymentToken: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
initialPrice:        5000000
initialDuration:     2592000
```

This means 5 USDC for 30 days on Base.

After deployment, put the verified contract address into `data/web3-tools.json` under `premium.contractAddress`.
