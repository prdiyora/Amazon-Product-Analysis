(function initUtils(root) {
  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function parseInteger(value) {
    const cleaned = normalizeWhitespace(value).replace(/[^\d]/g, "");
    return cleaned ? Number.parseInt(cleaned, 10) : null;
  }

  function parseCompactCount(value) {
    const text = normalizeWhitespace(value).toUpperCase().replace(/,/g, "");
    const match = text.match(/(\d+(?:\.\d+)?)\s*([KML])?\+?/);
    if (!match) {
      return null;
    }

    const multipliers = { K: 1_000, M: 1_000_000, L: 100_000 };
    const multiplier = multipliers[match[2]] || 1;
    return Math.round(Number.parseFloat(match[1]) * multiplier);
  }

  function parseDecimal(value) {
    const text = normalizeWhitespace(value).replace(/,/g, "");
    const match = text.match(/\d+(?:\.\d+)?/);
    return match ? Number.parseFloat(match[0]) : null;
  }

  function getAsinFromUrl(value) {
    const match = String(value || "").match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return match ? match[1].toUpperCase() : "";
  }

  function getMarketplaceFromUrl(value) {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      if (["amazon.in", "www.amazon.in"].includes(hostname)) {
        return "amazon.in";
      }
      if (["amazon.com", "www.amazon.com"].includes(hostname)) {
        return "amazon.com";
      }
      return "";
    } catch {
      return "";
    }
  }

  function toAmazonUrl(value, baseUrl = "https://www.amazon.in/") {
    try {
      const url = new URL(value, baseUrl);
      if (!getMarketplaceFromUrl(url.href)) {
        return "";
      }
      url.protocol = "https:";
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  function canonicalProductUrl(url, asin, baseUrl = "https://www.amazon.in/") {
    const normalizedAsin = asin || getAsinFromUrl(url);
    const absoluteUrl = toAmazonUrl(url, baseUrl);
    const marketplace =
      getMarketplaceFromUrl(absoluteUrl) ||
      getMarketplaceFromUrl(baseUrl) ||
      "amazon.in";
    return normalizedAsin
      ? `https://www.${marketplace}/dp/${normalizedAsin}`
      : absoluteUrl;
  }

  function compareProducts(left, right) {
    const leftBought = Number.isFinite(left.boughtCount) ? left.boughtCount : -1;
    const rightBought = Number.isFinite(right.boughtCount) ? right.boughtCount : -1;
    if (leftBought !== rightBought) {
      return rightBought - leftBought;
    }

    const leftReviews = Number.isFinite(left.reviewCount)
      ? left.reviewCount
      : Number.POSITIVE_INFINITY;
    const rightReviews = Number.isFinite(right.reviewCount)
      ? right.reviewCount
      : Number.POSITIVE_INFINITY;
    if (leftReviews !== rightReviews) {
      return leftReviews - rightReviews;
    }

    return String(left.asin || "").localeCompare(String(right.asin || ""));
  }

  function sleep(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, milliseconds);
      if (!signal) {
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          reject(new DOMException("Scraping cancel thayu.", "AbortError"));
        },
        { once: true }
      );
    });
  }

  const utils = {
    canonicalProductUrl,
    compareProducts,
    getAsinFromUrl,
    getMarketplaceFromUrl,
    normalizeWhitespace,
    parseCompactCount,
    parseDecimal,
    parseInteger,
    sleep,
    toAmazonUrl
  };

  root.AZScraper = root.AZScraper || {};
  root.AZScraper.utils = utils;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = utils;
  }
})(globalThis);
