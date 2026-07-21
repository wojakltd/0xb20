// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface used by the sender contract.
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title B20TokenSender
/// @notice Stateless ERC-20 batch sender for exact-approval distributions.
/// @dev The contract has no owner, no custody, no fees, and no upgrade path.
///      It transfers tokens directly from the caller to each recipient using `transferFrom`.
contract B20TokenSender {
    error InvalidToken();
    error EmptyBatch();
    error LengthMismatch();
    error ZeroRecipient();
    error ZeroAmount();
    error TransferFailed(address recipient, uint256 amount);
    error NativeCurrencyRejected();
    error ReentrantCall();

    event BatchSent(
        address indexed operator,
        address indexed token,
        uint256 recipients,
        uint256 totalAmount
    );

    bool private locked;

    modifier nonReentrant() {
        if (locked) {
            revert ReentrantCall();
        }

        locked = true;
        _;
        locked = false;
    }

    /// @notice Rejects native currency transfers.
    receive() external payable {
        revert NativeCurrencyRejected();
    }

    /// @notice Rejects unknown calls and native currency transfers.
    fallback() external payable {
        revert NativeCurrencyRejected();
    }

    /// @notice Sends ERC-20 tokens from the caller to multiple recipients.
    /// @dev The caller must approve this contract for at least the total amount before calling.
    /// @param token ERC-20 token contract address.
    /// @param recipients Recipient wallet addresses.
    /// @param amounts Token amounts in raw token units.
    /// @return totalAmount Total raw token amount transferred.
    function send(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant returns (uint256 totalAmount) {
        if (token == address(0)) {
            revert InvalidToken();
        }

        uint256 length = recipients.length;

        if (length == 0) {
            revert EmptyBatch();
        }

        if (length != amounts.length) {
            revert LengthMismatch();
        }

        for (uint256 index = 0; index < length; index++) {
            address recipient = recipients[index];
            uint256 amount = amounts[index];

            if (recipient == address(0)) {
                revert ZeroRecipient();
            }

            if (amount == 0) {
                revert ZeroAmount();
            }

            totalAmount += amount;

            (bool success, bytes memory result) = token.call(
                abi.encodeWithSelector(
                    IERC20Minimal.transferFrom.selector,
                    msg.sender,
                    recipient,
                    amount
                )
            );

            if (!success || (result.length != 0 && !abi.decode(result, (bool)))) {
                revert TransferFailed(recipient, amount);
            }
        }

        emit BatchSent(msg.sender, token, length, totalAmount);
    }
}
