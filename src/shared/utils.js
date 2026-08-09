(function initUtils(root) {
  const ANALYSIS_NAME_MAX_LENGTH = 94;
  const INVALID_SHEET_NAME_CHARACTERS = /[:\\/?*\[\]]/;

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

  function normalizeSearchQuery(value) {
    return normalizeWhitespace(value).toLowerCase();
  }

  function validateAnalysisName(value) {
    const name = normalizeWhitespace(value);
    if (!name) {
      return {
        valid: false,
        code: "ANALYSIS_NAME_MISSING",
        message: "Analysis tab name required chhe."
      };
    }
    if (INVALID_SHEET_NAME_CHARACTERS.test(name)) {
      return {
        valid: false,
        code: "ANALYSIS_NAME_INVALID_CHARACTERS",
        message: "Analysis name ma : \\ / ? * [ ] characters allowed nathi."
      };
    }
    if (name.length > ANALYSIS_NAME_MAX_LENGTH) {
      return {
        valid: false,
        code: "ANALYSIS_NAME_TOO_LONG",
        message: `Analysis name maximum ${ANALYSIS_NAME_MAX_LENGTH} characters nu hovu joie.`
      };
    }
    return { valid: true, name };
  }

  function buildAnalysisTabName(value, marketplace) {
    const validation = validateAnalysisName(value);
    if (!validation.valid) {
      return "";
    }
    const suffix = marketplace === "amazon.com" ? "USA" : "IN";
    return `${validation.name} - ${suffix}`;
  }

  function buildUploadPayload(state, products, runTimestamp = new Date().toISOString()) {
    return {
      token: state.token || "",
      runId: state.runId,
      runTimestamp,
      marketplace: state.marketplace,
      analysisName: state.analysisName,
      categoryUrl: state.categoryUrl,
      categoryName: state.categoryName,
      products: products.map((product) => ({
        runTimestamp,
        categoryUrl: state.categoryUrl,
        categoryName: state.categoryName,
        categoryPath: state.categoryPath,
        asin: product.asin || "",
        title: product.title || "",
        brand: product.brand || "",
        productUrl: product.productUrl || "",
        priceText: product.priceText || "",
        priceValue: product.priceValue ?? "",
        currency: product.currency || "",
        rating: product.rating ?? "",
        reviewCount: product.reviewCount ?? "",
        boughtText: product.boughtText || "",
        boughtCount: product.boughtCount ?? "",
        status: product.status || "incomplete",
        error: product.error || "",
        marketplace:
          state.marketplace || getMarketplaceFromUrl(product.productUrl)
      }))
    };
  }

  function buildAmazonSearchUrl(marketplace, query) {
    const normalizedMarketplace = ["amazon.in", "amazon.com"].includes(marketplace)
      ? marketplace
      : "amazon.in";
    const normalizedQuery = normalizeWhitespace(query);
    if (!normalizedQuery) {
      return "";
    }
    const url = new URL(`https://www.${normalizedMarketplace}/s`);
    url.searchParams.set("k", normalizedQuery);
    return url.href;
  }

  function getAmazonSearchQuery(value) {
    try {
      const url = new URL(value);
      if (!getMarketplaceFromUrl(url.href) || url.pathname !== "/s") {
        return "";
      }
      return normalizeWhitespace(url.searchParams.get("k"));
    } catch {
      return "";
    }
  }

  function isMatchingAmazonSearch(value, marketplace, query) {
    return (
      getMarketplaceFromUrl(value) === marketplace &&
      normalizeSearchQuery(getAmazonSearchQuery(value)) ===
        normalizeSearchQuery(query)
    );
  }

  function isAppsScriptEndpoint(value) {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "script.google.com" &&
        /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
      );
    } catch {
      return false;
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
    ANALYSIS_NAME_MAX_LENGTH,
    buildAnalysisTabName,
    buildAmazonSearchUrl,
    buildUploadPayload,
    canonicalProductUrl,
    compareProducts,
    getAmazonSearchQuery,
    getAsinFromUrl,
    getMarketplaceFromUrl,
    isAppsScriptEndpoint,
    isMatchingAmazonSearch,
    normalizeWhitespace,
    normalizeSearchQuery,
    parseCompactCount,
    parseDecimal,
    parseInteger,
    sleep,
    toAmazonUrl,
    validateAnalysisName
  };

  root.AZScraper = root.AZScraper || {};
  root.AZScraper.utils = utils;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = utils;
  }
})(globalThis);
