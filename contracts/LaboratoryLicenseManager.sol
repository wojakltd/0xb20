// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title 0XB20 Laboratory License Manager
/// @notice Issues one renewable Lab Pass per wallet after exact ERC-20 payment.
/// @dev Licenses are never trusted from browser storage; every tool checks this contract.
contract LaboratoryLicenseManager is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidPaymentToken();
    error InvalidPrice();
    error InvalidDuration();
    error ZeroAddress();
    error NativeCurrencyRejected();

    /// @notice Accepted payment token, expected to be USDC on Base for V1.
    IERC20 public acceptedPaymentToken;

    /// @notice Current license price in the accepted token's smallest unit.
    uint256 public price;

    /// @notice License duration applied to every purchase or renewal.
    uint64 public licenseDuration;

    mapping(address => uint256) private expiresAt;

    event LicensePurchased(
        address indexed account,
        address indexed paymentToken,
        uint256 paid,
        uint256 expiresAt
    );

    event LicenseExtended(
        address indexed account,
        address indexed paymentToken,
        uint256 paid,
        uint256 previousExpiresAt,
        uint256 expiresAt
    );

    event PriceUpdated(uint256 previousPrice, uint256 newPrice);
    event PaymentTokenUpdated(address indexed previousToken, address indexed newToken);
    event LicenseDurationUpdated(uint64 previousDuration, uint64 newDuration);
    event FundsWithdrawn(address indexed recipient, address indexed token, uint256 amount);

    /// @param initialOwner Wallet controlling price/token/pause/withdraw operations.
    /// @param initialPaymentToken ERC-20 token accepted for Lab Pass payments.
    /// @param initialPrice Price in the accepted token's smallest unit.
    /// @param initialDuration License duration in seconds.
    constructor(
        address initialOwner,
        IERC20 initialPaymentToken,
        uint256 initialPrice,
        uint64 initialDuration
    ) Ownable(initialOwner) {
        if (address(initialPaymentToken) == address(0)) revert InvalidPaymentToken();
        if (initialPrice == 0) revert InvalidPrice();
        if (initialDuration == 0) revert InvalidDuration();

        acceptedPaymentToken = initialPaymentToken;
        price = initialPrice;
        licenseDuration = initialDuration;
    }

    receive() external payable {
        revert NativeCurrencyRejected();
    }

    fallback() external payable {
        revert NativeCurrencyRejected();
    }

    /// @notice Purchases a new Lab Pass or extends an active one.
    /// @dev Active licenses extend from their current expiry, expired licenses start now.
    function purchase() external nonReentrant whenNotPaused returns (uint256 newExpiration) {
        uint256 previousExpiration = expiresAt[msg.sender];
        uint256 start = previousExpiration > block.timestamp ? previousExpiration : block.timestamp;

        newExpiration = start + licenseDuration;
        expiresAt[msg.sender] = newExpiration;

        acceptedPaymentToken.safeTransferFrom(msg.sender, address(this), price);

        if (previousExpiration >= block.timestamp) {
            emit LicenseExtended(
                msg.sender,
                address(acceptedPaymentToken),
                price,
                previousExpiration,
                newExpiration
            );
        } else {
            emit LicensePurchased(msg.sender, address(acceptedPaymentToken), price, newExpiration);
        }
    }

    /// @notice Returns true if the wallet currently has an active Lab Pass.
    function isLicenseActive(address account) external view returns (bool) {
        return expiresAt[account] >= block.timestamp;
    }

    /// @notice Returns the stored expiration timestamp for a wallet.
    function licenseExpiration(address account) external view returns (uint256) {
        return expiresAt[account];
    }

    /// @notice Updates the accepted price for future purchases only.
    function updatePrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();

        uint256 previousPrice = price;
        price = newPrice;
        emit PriceUpdated(previousPrice, newPrice);
    }

    /// @notice Updates the accepted ERC-20 token for future purchases only.
    function updatePaymentToken(IERC20 newPaymentToken) external onlyOwner {
        if (address(newPaymentToken) == address(0)) revert InvalidPaymentToken();

        address previousToken = address(acceptedPaymentToken);
        acceptedPaymentToken = newPaymentToken;
        emit PaymentTokenUpdated(previousToken, address(newPaymentToken));
    }

    /// @notice Updates the license duration for future purchases and renewals.
    function updateLicenseDuration(uint64 newDuration) external onlyOwner {
        if (newDuration == 0) revert InvalidDuration();

        uint64 previousDuration = licenseDuration;
        licenseDuration = newDuration;
        emit LicenseDurationUpdated(previousDuration, newDuration);
    }

    /// @notice Pauses new purchases and renewals.
    function pausePurchases() external onlyOwner {
        _pause();
    }

    /// @notice Resumes new purchases and renewals.
    function resumePurchases() external onlyOwner {
        _unpause();
    }

    /// @notice Withdraws collected payment tokens to a recipient.
    /// @param recipient Wallet receiving collected funds.
    /// @param amount Amount to withdraw. Use 0 to withdraw the full balance.
    function withdraw(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();

        uint256 balance = acceptedPaymentToken.balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount == 0) revert InvalidPrice();

        acceptedPaymentToken.safeTransfer(recipient, withdrawAmount);
        emit FundsWithdrawn(recipient, address(acceptedPaymentToken), withdrawAmount);
    }
}
