(function (global) {
  const storage = global.B20SenderStorage;

  function list() {
    return storage.readAddressBooks();
  }

  function save(name, payload) {
    const title = String(name || '').trim() || `Recipient Set ${new Date().toLocaleDateString('en-US')}`;
    const books = list();
    const item = {
      id: `book-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...payload
    };

    storage.saveAddressBooks([item, ...books]);
    return item;
  }

  function duplicate(id) {
    const books = list();
    const original = books.find((book) => book.id === id);

    if (!original) {
      throw new Error('Address book entry not found.');
    }

    return save(`${original.name} Copy`, {
      tokenAddress: original.tokenAddress,
      defaultAmount: original.defaultAmount,
      recipientsText: original.recipientsText
    });
  }

  function remove(id) {
    storage.saveAddressBooks(list().filter((book) => book.id !== id));
  }

  global.B20SenderAddressBook = {
    list,
    save,
    duplicate,
    remove
  };
})(window);
