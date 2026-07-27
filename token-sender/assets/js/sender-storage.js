(function (global) {
  const keys = {
    session: 'b20-token-sender-session',
    history: 'b20-token-sender-history',
    addressBooks: 'b20-token-sender-address-books',
    parserInbox: 'b20-token-sender-parser-inbox'
  };

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(key) {
    try {
      global.localStorage.removeItem(key);
    } catch (error) {
      // Local persistence is best-effort only.
    }
  }

  function saveSession(session) {
    return writeJson(keys.session, {
      ...session,
      updatedAt: new Date().toISOString()
    });
  }

  function readSession() {
    return readJson(keys.session, null);
  }

  function clearSession() {
    remove(keys.session);
  }

  function readHistory() {
    return readJson(keys.history, []);
  }

  function saveHistory(history) {
    return writeJson(keys.history, (history || []).slice(0, 50));
  }

  function readAddressBooks() {
    return readJson(keys.addressBooks, []);
  }

  function saveAddressBooks(addressBooks) {
    return writeJson(keys.addressBooks, (addressBooks || []).slice(0, 40));
  }

  function sendParserRecipients(payload) {
    return writeJson(keys.parserInbox, {
      ...payload,
      createdAt: new Date().toISOString()
    });
  }

  function consumeParserRecipients() {
    const payload = readJson(keys.parserInbox, null);
    remove(keys.parserInbox);
    return payload;
  }

  global.B20SenderStorage = {
    keys,
    readJson,
    writeJson,
    remove,
    saveSession,
    readSession,
    clearSession,
    readHistory,
    saveHistory,
    readAddressBooks,
    saveAddressBooks,
    sendParserRecipients,
    consumeParserRecipients
  };
})(window);
