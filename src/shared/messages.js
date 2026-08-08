(function initMessages(root) {
  const messages = Object.freeze({
    START_RUN: "START_RUN",
    CANCEL_RUN: "CANCEL_RUN",
    RETRY_UPLOAD: "RETRY_UPLOAD",
    GET_STATE: "GET_STATE",
    SCRAPE_START: "SCRAPE_START",
    SCRAPE_CANCEL: "SCRAPE_CANCEL",
    SCRAPE_PROGRESS: "SCRAPE_PROGRESS",
    SCRAPE_BATCH: "SCRAPE_BATCH",
    SCRAPE_COMPLETE: "SCRAPE_COMPLETE",
    SCRAPE_FAILED: "SCRAPE_FAILED",
    PARSE_CURRENT_PRODUCT: "PARSE_CURRENT_PRODUCT",
    FALLBACK_PRODUCT: "FALLBACK_PRODUCT"
  });

  root.AZScraper = root.AZScraper || {};
  root.AZScraper.messages = messages;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = messages;
  }
})(globalThis);
