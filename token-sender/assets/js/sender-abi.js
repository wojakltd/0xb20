(function (global) {
  const SELECTORS = {
    supportsInterface: '0x01ffc9a7',
    name: '0x06fdde03',
    symbol: '0x95d89b41',
    decimals: '0x313ce567',
    totalSupply: '0x18160ddd',
    balanceOf: '0x70a08231',
    allowance: '0xdd62ed3e',
    approve: '0x095ea7b3',
    ownerOf: '0x6352211e',
    getApproved: '0x081812fc',
    isApprovedForAll: '0xe985e9c5',
    setApprovalForAll: '0xa22cb465',
    safeTransferFrom721: '0x42842e0e',
    balanceOf1155: '0x00fdd58e',
    safeTransferFrom1155: '0xf242432a',
    senderErc20: '0xf8129cd2',
    assetSenderErc20: '0x780df281',
    assetSenderErc721: '0x05ff14c2',
    assetSenderErc1155: '0x7153175c',
    tokenURI: '0xc87b56dd',
    uri: '0x0e89341c',
    erc721InterfaceId: '0x80ac58cd',
    erc721EnumerableInterfaceId: '0x780e9d63',
    erc1155InterfaceId: '0xd9b67a26'
  };

  function stripHexPrefix(value) {
    return String(value || '').replace(/^0x/i, '');
  }

  function ensureHex(value) {
    return `0x${stripHexPrefix(value)}`;
  }

  function padHex(value) {
    return stripHexPrefix(value).padStart(64, '0');
  }

  function padAddress(address) {
    return padHex(stripHexPrefix(address).slice(-40));
  }

  function padUint256(value) {
    return BigInt(value || 0).toString(16).padStart(64, '0');
  }

  function encodeBool(value) {
    return padUint256(value ? 1 : 0);
  }

  function encodeAddressArray(addresses) {
    return [
      padUint256(addresses.length),
      ...addresses.map(padAddress)
    ].join('');
  }

  function encodeUintArray(values) {
    return [
      padUint256(values.length),
      ...values.map(padUint256)
    ].join('');
  }

  function encodeBytes(value) {
    const hex = stripHexPrefix(value || '0x');
    const byteLength = Math.ceil(hex.length / 2);
    const paddedLength = Math.ceil(byteLength / 32) * 64;

    return `${padUint256(byteLength)}${hex.padEnd(paddedLength, '0')}`;
  }

  function encodeDynamicString(value) {
    const encoded = new TextEncoder().encode(String(value || ''));
    const hex = Array.from(encoded).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const paddedLength = Math.ceil(encoded.length / 32) * 64;
    return `${padUint256(encoded.length)}${hex.padEnd(paddedLength, '0')}`;
  }

  function decodeUint(value) {
    const hex = stripHexPrefix(value);
    if (!hex || hex === '0'.repeat(hex.length)) {
      return 0n;
    }

    return BigInt(`0x${hex.slice(0, 64)}`);
  }

  function decodeBool(value) {
    return decodeUint(value) === 1n;
  }

  function decodeAddress(value) {
    const hex = stripHexPrefix(value).slice(24, 64);
    return hex ? `0x${hex}` : '0x0000000000000000000000000000000000000000';
  }

  function decodeString(value) {
    const hex = stripHexPrefix(value);

    if (!hex) {
      return '';
    }

    if (hex.length === 64) {
      const ascii = hex.match(/.{1,2}/g)
        .map((byte) => Number.parseInt(byte, 16))
        .filter(Boolean);
      return new TextDecoder().decode(new Uint8Array(ascii)).replace(/\0+$/g, '');
    }

    const offset = Number(decodeUint(hex.slice(0, 64)));
    const length = Number(decodeUint(hex.slice(offset * 2, offset * 2 + 64)));
    const body = hex.slice(offset * 2 + 64, offset * 2 + 64 + length * 2);
    const bytes = body.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [];
    return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\0+$/g, '');
  }

  async function call(to, data) {
    if (!global.B20Wallet) {
      throw new Error('Wallet service unavailable.');
    }

    return global.B20Wallet.callContract(to, data);
  }

  async function safeCall(to, data, fallback = '0x') {
    try {
      return await call(to, data);
    } catch (error) {
      return fallback;
    }
  }

  async function readString(to, selector, fallback = '') {
    const result = await safeCall(to, selector);
    return result && result !== '0x' ? decodeString(result) || fallback : fallback;
  }

  async function readUint(to, selector, fallback = 0n) {
    const result = await safeCall(to, selector);
    return result && result !== '0x' ? decodeUint(result) : BigInt(fallback);
  }

  async function readBool(to, selector, fallback = false) {
    const result = await safeCall(to, selector);
    return result && result !== '0x' ? decodeBool(result) : fallback;
  }

  async function readAddress(to, selector, fallback = '0x0000000000000000000000000000000000000000') {
    const result = await safeCall(to, selector);
    return result && result !== '0x' ? decodeAddress(result) : fallback;
  }

  function encodeSupportsInterface(interfaceId) {
    return `${SELECTORS.supportsInterface}${padHex(stripHexPrefix(interfaceId))}`;
  }

  function encodeBalanceOf(owner) {
    return `${SELECTORS.balanceOf}${padAddress(owner)}`;
  }

  function encodeAllowance(owner, spender) {
    return `${SELECTORS.allowance}${padAddress(owner)}${padAddress(spender)}`;
  }

  function encodeApprove(spender, amount) {
    return `${SELECTORS.approve}${padAddress(spender)}${padUint256(amount)}`;
  }

  function encodeOwnerOf(tokenId) {
    return `${SELECTORS.ownerOf}${padUint256(tokenId)}`;
  }

  function encodeGetApproved(tokenId) {
    return `${SELECTORS.getApproved}${padUint256(tokenId)}`;
  }

  function encodeIsApprovedForAll(owner, operator) {
    return `${SELECTORS.isApprovedForAll}${padAddress(owner)}${padAddress(operator)}`;
  }

  function encodeSetApprovalForAll(operator, approved) {
    return `${SELECTORS.setApprovalForAll}${padAddress(operator)}${encodeBool(approved)}`;
  }

  function encodeSafeTransferFrom721(from, to, tokenId) {
    return `${SELECTORS.safeTransferFrom721}${padAddress(from)}${padAddress(to)}${padUint256(tokenId)}`;
  }

  function encodeBalanceOf1155(owner, id) {
    return `${SELECTORS.balanceOf1155}${padAddress(owner)}${padUint256(id)}`;
  }

  function encodeSafeTransferFrom1155(from, to, id, amount, data = '0x') {
    const headSize = 5n * 32n;
    return [
      SELECTORS.safeTransferFrom1155,
      padAddress(from),
      padAddress(to),
      padUint256(id),
      padUint256(amount),
      padUint256(headSize),
      encodeBytes(data)
    ].join('');
  }

  function encodeAddressUintBatch(selector, asset, recipients, values) {
    const recipientsSegment = encodeAddressArray(recipients);
    const valuesSegment = encodeUintArray(values);
    const headSize = 3n * 32n;
    const valuesOffset = headSize + BigInt(recipientsSegment.length / 2);

    return [
      selector,
      padAddress(asset),
      padUint256(headSize),
      padUint256(valuesOffset),
      recipientsSegment,
      valuesSegment
    ].join('');
  }

  function encodeSenderErc20(token, recipients, amounts) {
    return encodeAddressUintBatch(SELECTORS.senderErc20, token, recipients, amounts);
  }

  function encodeAssetSenderErc20(token, recipients, amounts) {
    return encodeAddressUintBatch(SELECTORS.assetSenderErc20, token, recipients, amounts);
  }

  function encodeAssetSenderErc721(collection, recipients, tokenIds) {
    return encodeAddressUintBatch(SELECTORS.assetSenderErc721, collection, recipients, tokenIds);
  }

  function encodeAssetSenderErc1155(collection, recipients, ids, amounts, data = '0x') {
    const recipientsSegment = encodeAddressArray(recipients);
    const idsSegment = encodeUintArray(ids);
    const amountsSegment = encodeUintArray(amounts);
    const dataSegment = encodeBytes(data);
    const headSize = 5n * 32n;
    const idsOffset = headSize + BigInt(recipientsSegment.length / 2);
    const amountsOffset = idsOffset + BigInt(idsSegment.length / 2);
    const dataOffset = amountsOffset + BigInt(amountsSegment.length / 2);

    return [
      SELECTORS.assetSenderErc1155,
      padAddress(collection),
      padUint256(headSize),
      padUint256(idsOffset),
      padUint256(amountsOffset),
      padUint256(dataOffset),
      recipientsSegment,
      idsSegment,
      amountsSegment,
      dataSegment
    ].join('');
  }

  function encodeTokenUri(tokenId) {
    return `${SELECTORS.tokenURI}${padUint256(tokenId)}`;
  }

  function encodeUri(id) {
    return `${SELECTORS.uri}${padUint256(id)}`;
  }

  global.B20SenderAbi = {
    SELECTORS,
    stripHexPrefix,
    ensureHex,
    padAddress,
    padUint256,
    encodeAddressArray,
    encodeUintArray,
    encodeBytes,
    encodeDynamicString,
    decodeUint,
    decodeBool,
    decodeAddress,
    decodeString,
    call,
    safeCall,
    readString,
    readUint,
    readBool,
    readAddress,
    encodeSupportsInterface,
    encodeBalanceOf,
    encodeAllowance,
    encodeApprove,
    encodeOwnerOf,
    encodeGetApproved,
    encodeIsApprovedForAll,
    encodeSetApprovalForAll,
    encodeSafeTransferFrom721,
    encodeBalanceOf1155,
    encodeSafeTransferFrom1155,
    encodeSenderErc20,
    encodeAssetSenderErc20,
    encodeAssetSenderErc721,
    encodeAssetSenderErc1155,
    encodeTokenUri,
    encodeUri
  };
})(window);
