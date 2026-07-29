(function (global) {
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  function wallet() {
    if (!global.B20Wallet) {
      throw new Error('Wallet service unavailable.');
    }

    return global.B20Wallet;
  }

  function abi() {
    if (!global.B20SenderAbi) {
      throw new Error('Asset ABI module unavailable.');
    }

    return global.B20SenderAbi;
  }

  function normalizeId(value) {
    const text = String(value ?? '').trim();

    if (!/^\d+$/.test(text)) {
      throw new Error('token id must be a whole number.');
    }

    return BigInt(text).toString();
  }

  function normalizeAmount(value) {
    const text = String(value ?? '').trim();

    if (!/^\d+$/.test(text)) {
      throw new Error('ERC1155 amount must be a whole number.');
    }

    return text;
  }

  function splitCsvLine(line) {
    const cells = [];
    let current = '';
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        quoted = !quoted;
        continue;
      }

      if (char === ',' && !quoted) {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells;
  }

  function candidateLines(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^advanced:?$/i.test(line));
  }

  function formatSupply(value, decimals, symbol) {
    try {
      return `${wallet().formatUnits(value, decimals, 6)} ${symbol || ''}`.trim();
    } catch (error) {
      return '--';
    }
  }

  function uniqueKey(parts) {
    return parts.map((part) => String(part || '').toLowerCase()).join(':');
  }

  async function supportsInterface(address, interfaceId) {
    try {
      return await abi().readBool(address, abi().encodeSupportsInterface(interfaceId), false);
    } catch (error) {
      return false;
    }
  }

  function configuredAddress(config = {}) {
    if (!config.contractAddress || !wallet().isAddress(config.contractAddress)) {
      return '';
    }

    return wallet().normalizeAddress(config.contractAddress);
  }

  function universalSenderAddress(context = {}) {
    const config = context.assetSenderConfig || {};

    if (config.enabled === false) {
      return '';
    }

    return configuredAddress(config);
  }

  function legacySenderAddress(context = {}) {
    const config = context.senderConfig || {};

    if (config.enabled === false) {
      return '';
    }

    return configuredAddress(config);
  }

  function erc20SenderAddress(context = {}) {
    return universalSenderAddress(context) || legacySenderAddress(context);
  }

  async function verifySenderContract(address, requiredSelectors, label) {
    if (!address) {
      return {
        ready: false,
        message: `${label} contract is not configured.`
      };
    }

    const code = await wallet().readContractCode(address);
    const normalizedCode = String(code || '').toLowerCase();

    if (!normalizedCode || normalizedCode === '0x') {
      return {
        ready: false,
        message: `Configured ${label} address has no contract code on Base.`
      };
    }

    const missing = requiredSelectors.find((selector) => (
      !normalizedCode.includes(String(selector || '').replace(/^0x/i, '').toLowerCase())
    ));

    if (missing) {
      return {
        ready: false,
        message: `Configured ${label} does not expose the expected batch interface.`
      };
    }

    return {
      ready: true,
      message: `${label} ready on Base.`
    };
  }

  async function readCommonMetadata(address, owner, defaults = {}) {
    const name = await abi().readString(address, abi().SELECTORS.name, defaults.name || 'Unknown Collection');
    const symbol = await abi().readString(address, abi().SELECTORS.symbol, defaults.symbol || 'ASSET');
    const totalRaw = await abi().readUint(address, abi().SELECTORS.totalSupply, 0n);
    const balanceRaw = owner
      ? await abi().readUint(address, abi().encodeBalanceOf(owner), 0n)
      : 0n;

    return {
      address,
      name,
      symbol,
      decimals: defaults.decimals ?? 0,
      totalSupplyRaw: totalRaw.toString(),
      totalSupply: totalRaw ? formatSupply(totalRaw, defaults.decimals ?? 0, symbol) : '--',
      balanceRaw: balanceRaw.toString(),
      balance: defaults.balanceLabel || balanceRaw.toString()
    };
  }

  function createErc20Adapter(address) {
    return {
      type: 'erc20',
      label: 'ERC20',
      usesSenderContract: true,
      requiresApproval: true,
      address,
      async readMetadata(context) {
        return {
          ...(await wallet().readTokenInfo(context.address)),
          type: this.type,
          assetType: this.label
        };
      },
      parseRecipients(context) {
        const parsed = global.B20SenderImport.parseRecipients({
          text: context.text,
          defaultAmount: context.defaultAmount,
          decimals: context.decimals
        });

        parsed.recipients = parsed.recipients.map((recipient) => ({
          ...recipient,
          assetType: this.type
        }));
        parsed.totalLabel = `${parsed.totalFormatted} ${context.token?.symbol || 'TOKEN'}`;
        return parsed;
      },
      async validateTransfer(context) {
        if (context.token.balanceRaw && BigInt(context.parsed.totalRaw) > BigInt(context.token.balanceRaw)) {
          throw new Error(`Insufficient wallet balance. Required ${context.parsed.totalFormatted} ${context.token.symbol}, available ${context.token.balance} ${context.token.symbol}.`);
        }
      },
      async getReadiness(context) {
        const universal = universalSenderAddress(context);
        const legacy = legacySenderAddress(context);

        if (universal) {
          return verifySenderContract(universal, [
            abi().SELECTORS.assetSenderErc20,
            '0x23b872dd'
          ], 'Universal Asset Sender V2');
        }

        return verifySenderContract(legacy, [
          abi().SELECTORS.senderErc20,
          '0x23b872dd'
        ], 'Legacy ERC20 Sender');
      },
      async readApprovalState(context) {
        const spender = erc20SenderAddress(context);

        if (!spender) {
          return {
            raw: '0',
            ready: false,
            message: 'Sender contract is not configured.'
          };
        }

        const allowanceRaw = await wallet().readTokenAllowance(
          context.token.address,
          context.wallet.address,
          spender
        );

        return {
          raw: allowanceRaw,
          ready: BigInt(allowanceRaw) >= BigInt(context.parsed.totalRaw),
          message: 'Exact ERC20 approval required before transfer.'
        };
      },
      async requestApproval(context) {
        const spender = erc20SenderAddress(context);

        if (!spender) {
          throw new Error('Sender contract is not configured.');
        }

        return wallet().requestTokenApproval(
          context.token.address,
          spender,
          context.totalRaw
        );
      },
      buildBatchTransaction(context) {
        const addresses = context.recipients.map((recipient) => recipient.address);
        const amounts = context.recipients.map((recipient) => recipient.amountRaw);
        const universal = universalSenderAddress(context);
        const sender = universal || legacySenderAddress(context);

        if (!sender) {
          throw new Error('Sender contract is not configured.');
        }

        return {
          to: sender,
          value: '0x0',
          data: universal
            ? abi().encodeAssetSenderErc20(context.token.address, addresses, amounts)
            : abi().encodeSenderErc20(context.token.address, addresses, amounts)
        };
      },
      describeRecipient(recipient, token) {
        return `${recipient.amount} ${token.symbol}`;
      }
    };
  }

  function createErc721Adapter(address, options = {}) {
    const usesUniversalSender = Boolean(options.useUniversalSender);

    return {
      type: 'erc721',
      label: 'ERC721',
      usesSenderContract: usesUniversalSender,
      requiresApproval: usesUniversalSender,
      address,
      async readMetadata(context) {
        const metadata = await readCommonMetadata(context.address, context.owner, {
          name: 'NFT Collection',
          symbol: 'NFT',
          decimals: 0
        });

        return {
          ...metadata,
          type: this.type,
          assetType: this.label,
          balance: `${metadata.balanceRaw} NFTs`
        };
      },
      parseRecipients(context) {
        const errors = [];
        const warnings = [];
        const recipients = [];
        const seenTokenIds = new Set();
        const seenRows = new Set();
        const lines = candidateLines(context.text);
        const tokenIds = candidateLines(context.tokenIdsText);
        let duplicatesRemoved = 0;
        let invalidLines = 0;

        lines.forEach((line, index) => {
          try {
            const cells = splitCsvLine(line);
            const address = wallet().normalizeAddress(cells[0]);
            const tokenId = normalizeId(cells[1] || tokenIds[index] || '');
            const tokenKey = tokenId.toLowerCase();
            const rowKey = uniqueKey([address, tokenId]);

            if (seenTokenIds.has(tokenKey) || seenRows.has(rowKey)) {
              duplicatesRemoved += 1;
              return;
            }

            seenTokenIds.add(tokenKey);
            seenRows.add(rowKey);
            recipients.push({
              address,
              tokenId,
              amount: `Token #${tokenId}`,
              amountRaw: '1',
              assetType: this.type
            });
          } catch (error) {
            invalidLines += 1;
            if (errors.length < 30) {
              errors.push(`Line ${index + 1}: ${global.B20SenderCore.errorMessage(error, 'invalid NFT recipient.')}`);
            }
          }
        });

        if (duplicatesRemoved) {
          warnings.push(`${duplicatesRemoved} duplicate token IDs removed.`);
        }

        if (!recipients.length && !errors.length) {
          errors.push('No NFT recipients detected. Use address,tokenId or fill Token IDs.');
        }

        return {
          errors,
          warnings,
          recipients,
          totalRaw: BigInt(recipients.length),
          totalFormatted: String(recipients.length),
          totalLabel: `${recipients.length} NFTs`,
          duplicatesRemoved,
          invalidLines,
          variableAmounts: true
        };
      },
      async validateTransfer(context) {
        const owner = context.wallet.address.toLowerCase();

        for (const recipient of context.parsed.recipients) {
          const ownerResult = await abi().readAddress(context.token.address, abi().encodeOwnerOf(recipient.tokenId), ZERO_ADDRESS);

          if (ownerResult.toLowerCase() !== owner) {
            throw new Error(`Token #${recipient.tokenId} is not owned by the connected wallet.`);
          }
        }
      },
      async getReadiness(context) {
        const universal = universalSenderAddress(context);

        if (universal) {
          return verifySenderContract(universal, [
            abi().SELECTORS.assetSenderErc721,
            abi().SELECTORS.safeTransferFrom721
          ], 'Universal Asset Sender V2');
        }

        return {
          ready: true,
          message: 'ERC721 safe transfer mode. Wallet confirms each NFT transfer.'
        };
      },
      async readApprovalState(context) {
        const universal = universalSenderAddress(context);

        if (!universal) {
          return {
            raw: '0',
            ready: true,
            message: 'No global approval requested. Each NFT transfer is confirmed by the wallet.'
          };
        }

        const operatorApproved = await abi().readBool(
          context.token.address,
          abi().encodeIsApprovedForAll(context.wallet.address, universal),
          false
        );

        if (operatorApproved) {
          return {
            raw: '1',
            ready: true,
            message: 'Collection approval confirmed for Universal Asset Sender V2.'
          };
        }

        const notApproved = [];

        for (const recipient of context.parsed.recipients) {
          const approved = await abi().readAddress(
            context.token.address,
            abi().encodeGetApproved(recipient.tokenId),
            ZERO_ADDRESS
          );

          if (approved.toLowerCase() !== universal.toLowerCase()) {
            notApproved.push(recipient.tokenId);

            if (notApproved.length >= 5) {
              break;
            }
          }
        }

        return {
          raw: '0',
          ready: !notApproved.length,
          message: notApproved.length
            ? 'Collection approval is required for NFT batch transfer.'
            : 'Per-token approvals detected for selected NFTs.'
        };
      },
      async requestApproval(context) {
        const universal = universalSenderAddress(context);

        if (!universal) {
          throw new Error('ERC721 direct transfer mode does not require prior approval.');
        }

        return wallet().sendTransaction({
          to: context.token.address,
          value: '0x0',
          data: abi().encodeSetApprovalForAll(universal, true)
        });
      },
      buildBatchTransaction(context) {
        const universal = universalSenderAddress(context);

        if (universal) {
          return {
            to: universal,
            value: '0x0',
            data: abi().encodeAssetSenderErc721(
              context.token.address,
              context.recipients.map((recipient) => recipient.address),
              context.recipients.map((recipient) => recipient.tokenId)
            )
          };
        }

        const recipient = context.recipients[0];

        if (!recipient) {
          throw new Error('NFT transfer batch is empty.');
        }

        return {
          to: context.token.address,
          value: '0x0',
          data: abi().encodeSafeTransferFrom721(context.wallet.address, recipient.address, recipient.tokenId)
        };
      },
      describeRecipient(recipient) {
        return `Token #${recipient.tokenId}`;
      }
    };
  }

  function createErc1155Adapter(address, options = {}) {
    const usesUniversalSender = Boolean(options.useUniversalSender);

    return {
      type: 'erc1155',
      label: 'ERC1155',
      usesSenderContract: usesUniversalSender,
      requiresApproval: usesUniversalSender,
      address,
      async readMetadata(context) {
        const metadata = await readCommonMetadata(context.address, context.owner, {
          name: 'ERC1155 Collection',
          symbol: 'ERC1155',
          decimals: 0,
          balanceLabel: 'Scan IDs below'
        });

        return {
          ...metadata,
          type: this.type,
          assetType: this.label
        };
      },
      parseRecipients(context) {
        const errors = [];
        const warnings = [];
        const recipients = [];
        const seen = new Set();
        const lines = candidateLines(context.text);
        const defaultId = candidateLines(context.tokenIdsText)[0] || '';
        const defaultAmount = String(context.defaultAmount || '').trim() || '1';
        const totalsById = new Map();
        let duplicatesRemoved = 0;
        let invalidLines = 0;

        lines.forEach((line, index) => {
          try {
            const cells = splitCsvLine(line);
            const address = wallet().normalizeAddress(cells[0]);
            const id = normalizeId(cells.length >= 3 ? cells[1] : defaultId);
            const amount = normalizeAmount(cells.length >= 3 ? cells[2] : cells[1] || defaultAmount);
            const amountRaw = BigInt(amount).toString();
            const rowKey = uniqueKey([address, id, amountRaw]);

            if (seen.has(rowKey)) {
              duplicatesRemoved += 1;
              return;
            }

            seen.add(rowKey);
            totalsById.set(id, (totalsById.get(id) || 0n) + BigInt(amountRaw));
            recipients.push({
              address,
              tokenId: id,
              amount,
              amountRaw,
              assetType: this.type
            });
          } catch (error) {
            invalidLines += 1;
            if (errors.length < 30) {
              errors.push(`Line ${index + 1}: ${global.B20SenderCore.errorMessage(error, 'invalid ERC1155 recipient.')}`);
            }
          }
        });

        if (duplicatesRemoved) {
          warnings.push(`${duplicatesRemoved} duplicate ERC1155 rows removed.`);
        }

        if (!recipients.length && !errors.length) {
          errors.push('No ERC1155 recipients detected. Use address,id,amount.');
        }

        const totalRaw = Array.from(totalsById.values()).reduce((total, value) => total + value, 0n);

        return {
          errors,
          warnings,
          recipients,
          totalRaw,
          totalFormatted: totalRaw.toString(),
          totalLabel: `${totalRaw.toString()} units`,
          totalsById,
          duplicatesRemoved,
          invalidLines,
          variableAmounts: true
        };
      },
      async validateTransfer(context) {
        const totalsById = context.parsed.totalsById || new Map();

        for (const [id, required] of totalsById.entries()) {
          const balance = await abi().readUint(context.token.address, abi().encodeBalanceOf1155(context.wallet.address, id), 0n);

          if (balance < required) {
            throw new Error(`Insufficient ERC1155 balance for ID ${id}. Required ${required.toString()}, available ${balance.toString()}.`);
          }
        }
      },
      async getReadiness(context) {
        const universal = universalSenderAddress(context);

        if (universal) {
          return verifySenderContract(universal, [
            abi().SELECTORS.assetSenderErc1155,
            abi().SELECTORS.safeTransferFrom1155
          ], 'Universal Asset Sender V2');
        }

        return {
          ready: true,
          message: 'ERC1155 safe transfer mode. Wallet confirms each transfer.'
        };
      },
      async readApprovalState(context) {
        const universal = universalSenderAddress(context);

        if (!universal) {
          return {
            raw: '0',
            ready: true,
            message: 'No global approval requested. Each ERC1155 transfer is confirmed by the wallet.'
          };
        }

        const approved = await abi().readBool(
          context.token.address,
          abi().encodeIsApprovedForAll(context.wallet.address, universal),
          false
        );

        return {
          raw: approved ? '1' : '0',
          ready: approved,
          message: approved
            ? 'ERC1155 collection approval confirmed for Universal Asset Sender V2.'
            : 'ERC1155 collection approval is required for batch transfer.'
        };
      },
      async requestApproval(context) {
        const universal = universalSenderAddress(context);

        if (!universal) {
          throw new Error('ERC1155 direct transfer mode does not require prior approval.');
        }

        return wallet().sendTransaction({
          to: context.token.address,
          value: '0x0',
          data: abi().encodeSetApprovalForAll(universal, true)
        });
      },
      buildBatchTransaction(context) {
        const universal = universalSenderAddress(context);

        if (universal) {
          return {
            to: universal,
            value: '0x0',
            data: abi().encodeAssetSenderErc1155(
              context.token.address,
              context.recipients.map((recipient) => recipient.address),
              context.recipients.map((recipient) => recipient.tokenId),
              context.recipients.map((recipient) => recipient.amountRaw),
              '0x'
            )
          };
        }

        const recipient = context.recipients[0];

        if (!recipient) {
          throw new Error('ERC1155 transfer batch is empty.');
        }

        return {
          to: context.token.address,
          value: '0x0',
          data: abi().encodeSafeTransferFrom1155(
            context.wallet.address,
            recipient.address,
            recipient.tokenId,
            recipient.amountRaw,
            '0x'
          )
        };
      },
      describeRecipient(recipient) {
        return `ID ${recipient.tokenId} / ${recipient.amount} units`;
      }
    };
  }

  async function detect(context) {
    const address = wallet().normalizeAddress(context.address);
    const code = await wallet().readContractCode(address);

    if (!code || code === '0x') {
      throw new Error('Asset contract has no bytecode on Base.');
    }

    if (await supportsInterface(address, abi().SELECTORS.erc721InterfaceId)) {
      return createErc721Adapter(address, {
        useUniversalSender: Boolean(universalSenderAddress(context))
      });
    }

    if (await supportsInterface(address, abi().SELECTORS.erc1155InterfaceId)) {
      return createErc1155Adapter(address, {
        useUniversalSender: Boolean(universalSenderAddress(context))
      });
    }

    try {
      await wallet().readTokenInfo(address);
      return createErc20Adapter(address);
    } catch (error) {
      throw new Error('Unknown asset contract. ERC20, ERC721 or ERC1155 interface was not detected.');
    }
  }

  global.B20AssetAdapters = {
    detect,
    createErc20Adapter,
    createErc721Adapter,
    createErc1155Adapter
  };
})(window);
