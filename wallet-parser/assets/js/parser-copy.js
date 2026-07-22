(function () {
  async function copyLines(lines) {
    const text = lines
      .filter(Boolean)
      .map((line) => String(line).trim())
      .filter(Boolean)
      .join('\n');

    if (!text) {
      throw new Error('No addresses available to copy.');
    }

    await navigator.clipboard.writeText(text);
    return text;
  }

  window.B20ParserCopy = {
    copyLines
  };
})();
