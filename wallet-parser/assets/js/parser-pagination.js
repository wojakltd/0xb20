(function () {
  class ParserPagination {
    constructor(pageSize = 100) {
      this.pageSize = pageSize;
    }

    clampPage(pageIndex, itemCount) {
      const maxPage = Math.max(0, Math.ceil(itemCount / this.pageSize) - 1);
      return Math.max(0, Math.min(Number(pageIndex) || 0, maxPage));
    }

    pageItems(items, pageIndex) {
      const safeItems = Array.isArray(items) ? items : [];
      const safePage = this.clampPage(pageIndex, safeItems.length);
      const start = safePage * this.pageSize;
      return safeItems.slice(start, start + this.pageSize);
    }

    range(pageIndex, itemCount) {
      if (!itemCount) {
        return {
          start: 0,
          end: 0,
          total: 0
        };
      }

      const safePage = this.clampPage(pageIndex, itemCount);
      const start = safePage * this.pageSize + 1;
      const end = Math.min(itemCount, start + this.pageSize - 1);

      return {
        start,
        end,
        total: itemCount
      };
    }
  }

  window.B20ParserPagination = {
    ParserPagination
  };
})();
