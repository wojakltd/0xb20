// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LaboratoryReferralVault
/// @notice Minimal payout vault for the 0XB20 Laboratory partner program.
/// @dev The vault stores payout funds only. Referral trees, percentages and reward accounting stay off-chain.
contract LaboratoryReferralVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Token used for partner payouts.
    IERC20 public immutable payoutToken;

    event DepositReceived(address indexed operator, uint256 amount);
    event WithdrawExecuted(address indexed recipient, uint256 amount, bytes32 indexed withdrawalId);
    event EmergencyPaused(address indexed operator);
    event EmergencyResumed(address indexed operator);
    event TokenRecovered(address indexed token, address indexed recipient, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();

    constructor(IERC20 initialPayoutToken, address initialOwner) Ownable(initialOwner) {
        if (address(initialPayoutToken) == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }

        payoutToken = initialPayoutToken;
    }

    /// @notice Deposit payout tokens into the vault.
    /// @param amount Amount of payoutToken to transfer into the vault.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) {
            revert ZeroAmount();
        }

        payoutToken.safeTransferFrom(msg.sender, address(this), amount);
        emit DepositReceived(msg.sender, amount);
    }

    /// @notice Execute an owner-approved partner payout.
    /// @dev Initial version uses owner execution; withdrawalId lets backend and chain records match.
    function withdraw(address recipient, uint256 amount, bytes32 withdrawalId) external onlyOwner nonReentrant whenNotPaused {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }

        if (amount == 0) {
            revert ZeroAmount();
        }

        payoutToken.safeTransfer(recipient, amount);
        emit WithdrawExecuted(recipient, amount, withdrawalId);
    }

    /// @notice Pause deposits and withdrawals during an emergency.
    function pause() external onlyOwner {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /// @notice Resume deposits and withdrawals.
    function resume() external onlyOwner {
        _unpause();
        emit EmergencyResumed(msg.sender);
    }

    /// @notice Recover tokens accidentally sent to the vault.
    /// @param token ERC-20 token to recover.
    /// @param recipient Address receiving recovered tokens.
    /// @param amount Amount to recover. Pass 0 to recover the full token balance.
    function recoverTokens(IERC20 token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (address(token) == address(0) || recipient == address(0)) {
            revert ZeroAddress();
        }

        uint256 recoverAmount = amount == 0 ? token.balanceOf(address(this)) : amount;

        if (recoverAmount == 0) {
            revert ZeroAmount();
        }

        token.safeTransfer(recipient, recoverAmount);
        emit TokenRecovered(address(token), recipient, recoverAmount);
    }
}
