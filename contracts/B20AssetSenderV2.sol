// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface used by the asset sender.
interface IERC20MinimalV2 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Minimal ERC-721 interface used by the asset sender.
interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice Minimal ERC-1155 interface used by the asset sender.
interface IERC1155Minimal {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}

/// @title B20AssetSenderV2
/// @notice Stateless Base asset sender supporting ERC-20, ERC-721 and ERC-1155 batch distributions.
/// @dev No owner, no custody, no fees, no upgradeability, no delegatecall, and no withdrawal path.
contract B20AssetSenderV2 {
    error InvalidAsset();
    error EmptyBatch();
    error LengthMismatch();
    error ZeroRecipient();
    error ZeroAmount();
    error TransferFailed(address recipient, uint256 amount);
    error NativeCurrencyRejected();
    error ReentrantCall();
    error NotTokenOwner(uint256 tokenId);
    error AssetNotApproved(uint256 tokenId);
    error InsufficientBalance(uint256 id, uint256 required, uint256 available);
    error DuplicateTokenId(uint256 tokenId);

    event ERC20BatchSent(
        address indexed operator,
        address indexed token,
        uint256 recipients,
        uint256 totalAmount
    );

    event ERC721BatchSent(
        address indexed operator,
        address indexed collection,
        uint256 recipients
    );

    event ERC1155BatchSent(
        address indexed operator,
        address indexed collection,
        uint256 transfers,
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
    /// @param token ERC-20 token contract address.
    /// @param recipients Recipient wallet addresses.
    /// @param amounts Raw ERC-20 token amounts.
    /// @return totalAmount Total raw amount transferred.
    function batchERC20(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant returns (uint256 totalAmount) {
        if (token == address(0)) {
            revert InvalidAsset();
        }

        uint256 length = recipients.length;

        if (length == 0) {
            revert EmptyBatch();
        }

        if (length != amounts.length) {
            revert LengthMismatch();
        }

        for (uint256 index = 0; index < length;) {
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
                    IERC20MinimalV2.transferFrom.selector,
                    msg.sender,
                    recipient,
                    amount
                )
            );

            if (!success || (result.length != 0 && !abi.decode(result, (bool)))) {
                revert TransferFailed(recipient, amount);
            }

            unchecked {
                index++;
            }
        }

        emit ERC20BatchSent(msg.sender, token, length, totalAmount);
    }

    /// @notice Sends ERC-721 tokens owned by the caller to multiple recipients.
    /// @param collection ERC-721 collection contract address.
    /// @param recipients Recipient wallet addresses.
    /// @param tokenIds Token IDs transferred in recipient order.
    function batchERC721(
        address collection,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external nonReentrant {
        if (collection == address(0)) {
            revert InvalidAsset();
        }

        uint256 length = recipients.length;

        if (length == 0) {
            revert EmptyBatch();
        }

        if (length != tokenIds.length) {
            revert LengthMismatch();
        }

        IERC721Minimal asset = IERC721Minimal(collection);
        bool operatorApproved = asset.isApprovedForAll(msg.sender, address(this));

        for (uint256 index = 0; index < length;) {
            address recipient = recipients[index];
            uint256 tokenId = tokenIds[index];

            if (recipient == address(0)) {
                revert ZeroRecipient();
            }

            for (uint256 previous = 0; previous < index;) {
                if (tokenIds[previous] == tokenId) {
                    revert DuplicateTokenId(tokenId);
                }

                unchecked {
                    previous++;
                }
            }

            if (asset.ownerOf(tokenId) != msg.sender) {
                revert NotTokenOwner(tokenId);
            }

            if (!operatorApproved && asset.getApproved(tokenId) != address(this)) {
                revert AssetNotApproved(tokenId);
            }

            asset.safeTransferFrom(msg.sender, recipient, tokenId);

            unchecked {
                index++;
            }
        }

        emit ERC721BatchSent(msg.sender, collection, length);
    }

    /// @notice Sends ERC-1155 assets owned by the caller to multiple recipients.
    /// @param collection ERC-1155 collection contract address.
    /// @param recipients Recipient wallet addresses.
    /// @param ids ERC-1155 token IDs.
    /// @param amounts Unit amounts per transfer.
    /// @param data Optional ERC-1155 receiver hook data.
    /// @return totalAmount Total units transferred across all IDs.
    function batchERC1155(
        address collection,
        address[] calldata recipients,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external nonReentrant returns (uint256 totalAmount) {
        if (collection == address(0)) {
            revert InvalidAsset();
        }

        uint256 length = recipients.length;

        if (length == 0) {
            revert EmptyBatch();
        }

        if (length != ids.length || length != amounts.length) {
            revert LengthMismatch();
        }

        IERC1155Minimal asset = IERC1155Minimal(collection);

        if (!asset.isApprovedForAll(msg.sender, address(this))) {
            revert AssetNotApproved(0);
        }

        for (uint256 index = 0; index < length;) {
            address recipient = recipients[index];
            uint256 id = ids[index];
            uint256 amount = amounts[index];

            if (recipient == address(0)) {
                revert ZeroRecipient();
            }

            if (amount == 0) {
                revert ZeroAmount();
            }

            uint256 available = asset.balanceOf(msg.sender, id);

            if (available < amount) {
                revert InsufficientBalance(id, amount, available);
            }

            totalAmount += amount;
            asset.safeTransferFrom(msg.sender, recipient, id, amount, data);

            unchecked {
                index++;
            }
        }

        emit ERC1155BatchSent(msg.sender, collection, length, totalAmount);
    }
}
