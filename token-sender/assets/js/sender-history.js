(function (global) {
  const storage = global.B20SenderStorage;
  const core = global.B20SenderCore;

  function list() {
    return storage.readHistory();
  }

  function add(entry) {
    const history = list();
    const record = {
      id: `send-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      date: core.nowIso(),
      ...entry
    };

    storage.saveHistory([record, ...history]);
    return record;
  }

  function clear() {
    storage.saveHistory([]);
  }

  global.B20SenderHistory = {
    list,
    add,
    clear
  };
})(window);
