// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title 0XB20 Laboratory License Manager
/// @notice Issues one renewable Lab Pass per wallet through one shared on-chain license system.
/// @dev `paymentToken == address(0)` means native ETH. Any ERC-20 address enables token payments.
contract LaboratoryLicenseManager is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidPrice();
    error InvalidDuration();
    error InvalidPaymentValue(uint256 expected, uint256 received);
    error UnexpectedNativeCurrency();
    error ZeroAddress();
    error NothingToWithdraw();
    error WithdrawFailed();

    /// @notice Native ETH payment sentinel.
    address public constant NATIVE_PAYMENT = address(0);

    /// @notice Payment token. `address(0)` means native ETH.
    address public paymentToken;

    /// @notice Current license price in wei for native ETH, or token smallest units for ERC-20 payments.
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
    event NativeFundsWithdrawn(address indexed recipient, uint256 amount);
    event TokenFundsWithdrawn(address indexed recipient, address indexed token, uint256 amount);

    /// @param initialOwner Wallet controlling price/token/pause/withdraw operations.
    /// @param initialPaymentToken Payment token. Use `address(0)` for native ETH.
    /// @param initialPrice Price in wei for native ETH, or token smallest units for ERC-20 payments.
    /// @param initialDuration License duration in seconds.
    constructor(
        address initialOwner,
        address initialPaymentToken,
        uint256 initialPrice,
        uint64 initialDuration
    ) Ownable(initialOwner) {
        if (initialPrice == 0) revert InvalidPrice();
        if (initialDuration == 0) revert InvalidDuration();

        paymentToken = initialPaymentToken;
        price = initialPrice;
        licenseDuration = initialDuration;
    }

    receive() external payable {
        revert UnexpectedNativeCurrency();
    }

    fallback() external payable {
        revert UnexpectedNativeCurrency();
    }

    /// @notice Purchases a new Lab Pass or extends an active one.
    /// @dev Active licenses extend from current expiry; expired licenses start from current block time.
    function purchase() external payable nonReentrant whenNotPaused returns (uint256 newExpiration) {
        address activePaymentToken = paymentToken;
        uint256 activePrice = price;

        if (activePaymentToken == NATIVE_PAYMENT) {
            if (msg.value != activePrice) {
                revert InvalidPaymentValue(activePrice, msg.value);
            }
        } else {
            if (msg.value != 0) revert UnexpectedNativeCurrency();
            IERC20(activePaymentToken).safeTransferFrom(msg.sender, address(this), activePrice);
        }

        uint256 previousExpiration = expiresAt[msg.sender];
        uint256 start = previousExpiration > block.timestamp ? previousExpiration : block.timestamp;
        newExpiration = start + licenseDuration;
        expiresAt[msg.sender] = newExpiration;

        if (previousExpiration >= block.timestamp) {
            emit LicenseExtended(
                msg.sender,
                activePaymentToken,
                activePrice,
                previousExpiration,
                newExpiration
            );
        } else {
            emit LicensePurchased(msg.sender, activePaymentToken, activePrice, newExpiration);
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

    /// @notice Updates the payment asset for future purchases only.
    /// @dev Use `address(0)` for native ETH.
    function updatePaymentToken(address newPaymentToken) external onlyOwner {
        address previousToken = paymentToken;
        paymentToken = newPaymentToken;
        emit PaymentTokenUpdated(previousToken, newPaymentToken);
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

    /// @notice Withdraws collected native ETH payments.
    /// @param recipient Wallet receiving collected funds.
    /// @param amount Amount to withdraw. Use 0 to withdraw the full native balance.
    function withdrawNative(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();

        uint256 balance = address(this).balance;
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount == 0) revert NothingToWithdraw();

        (bool success, ) = recipient.call{value: withdrawAmount}("");
        if (!success) revert WithdrawFailed();

        emit NativeFundsWithdrawn(recipient, withdrawAmount);
    }

    /// @notice Withdraws ERC-20 payments or tokens accidentally sent to the contract.
    /// @param token ERC-20 token address.
    /// @param recipient Wallet receiving collected funds.
    /// @param amount Amount to withdraw. Use 0 to withdraw the full token balance.
    function withdrawToken(IERC20 token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (address(token) == address(0)) revert ZeroAddress();
        if (recipient == address(0)) revert ZeroAddress();

        uint256 balance = token.balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount == 0) revert NothingToWithdraw();

        token.safeTransfer(recipient, withdrawAmount);
        emit TokenFundsWithdrawn(recipient, address(token), withdrawAmount);
    }
}
