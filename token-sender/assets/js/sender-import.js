(function (global) {
  const core = global.B20SenderCore;

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

  function detectHeader(cells) {
    const normalized = cells.map((cell) => String(cell || '').trim().toLowerCase());
    const addressIndex = normalized.findIndex((cell) => ['wallet', 'address', 'recipient'].includes(cell));
    const amountIndex = normalized.findIndex((cell) => cell === 'amount' || cell === 'tokens');

    if (addressIndex === -1) {
      return null;
    }

    return {
      addressIndex,
      amountIndex
    };
  }

  function lineParts(line, header, defaultAmount) {
    if (!line.includes(',')) {
      return [line.trim(), defaultAmount];
    }

    const cells = splitCsvLine(line);

    if (header) {
      return [
        cells[header.addressIndex] || '',
        header.amountIndex >= 0 ? cells[header.amountIndex] || defaultAmount : defaultAmount
      ];
    }

    return [cells[0] || '', cells[1] || defaultAmount];
  }

  function parseRecipients(options) {
    const wallet = global.B20Wallet;
    const text = String(options.text || '');
    const defaultAmount = String(options.defaultAmount || '').trim();
    const decimals = Number(options.decimals ?? 18);
    const errors = [];
    const warnings = [];
    const recipients = [];
    const seen = new Set();
    const lines = text.split(/\r?\n/);
    let totalRaw = 0n;
    let duplicatesRemoved = 0;
    let invalidLines = 0;
    let header = null;

    if (!wallet) {
      throw new Error('Wallet utilities unavailable.');
    }

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed || /^advanced:?$/i.test(trimmed)) {
        return;
      }

      const cells = trimmed.includes(',') ? splitCsvLine(trimmed) : [trimmed];
      const possibleHeader = detectHeader(cells);

      if (possibleHeader && !header && index <= 1) {
        header = possibleHeader;
        return;
      }

      const [addressInput, amountInput] = lineParts(trimmed, header, defaultAmount);

      if (!amountInput) {
        invalidLines += 1;
        if (errors.length < 30) {
          errors.push(`Line ${index + 1}: add an amount or fill Amount Per Wallet.`);
        }
        return;
      }

      try {
        const address = wallet.normalizeAddress(addressInput);
        const key = address.toLowerCase();

        if (seen.has(key)) {
          duplicatesRemoved += 1;
          return;
        }

        const amountRaw = wallet.parseUnits(amountInput, decimals);

        if (amountRaw <= 0n) {
          throw new Error('amount must be greater than zero.');
        }

        seen.add(key);
        totalRaw += amountRaw;
        recipients.push({
          address,
          amount: amountInput,
          amountRaw: amountRaw.toString()
        });
      } catch (error) {
        invalidLines += 1;
        if (errors.length < 30) {
          errors.push(`Line ${index + 1}: ${core.errorMessage(error, 'invalid recipient.')}`);
        }
      }
    });

    if (invalidLines > errors.length) {
      errors.push(`${invalidLines - errors.length} additional invalid lines hidden.`);
    }

    if (duplicatesRemoved) {
      warnings.push(`${duplicatesRemoved} duplicate recipients removed.`);
    }

    if (!recipients.length && !errors.length) {
      errors.push('No recipients detected.');
    }

    return {
      errors,
      warnings,
      recipients,
      totalRaw,
      totalFormatted: wallet.formatUnits(totalRaw, decimals, 6),
      duplicatesRemoved,
      invalidLines,
      variableAmounts: recipients.some((recipient) => recipient.amount !== defaultAmount)
    };
  }

  function recipientsToText(recipients, includeAmounts = false) {
    return (recipients || [])
      .map((recipient) => includeAmounts ? `${recipient.address},${recipient.amount}` : recipient.address)
      .join('\n');
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Import file could not be read.'));
      reader.readAsText(file);
    });
  }

  global.B20SenderImport = {
    parseRecipients,
    recipientsToText,
    readFile
  };
})(window);
