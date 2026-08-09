(function initListingParser(root) {
  const utils =
    root.AZScraper?.utils ||
    (typeof require === "function" ? require("../shared/utils.js") : null);

  function isSponsored(card) {
    if (
      card.querySelector(
        ".s-sponsored-label-text, [data-component-type='sp-sponsored-result'], [class*='puis-sponsored-label']"
      )
    ) {
      return true;
    }

    const labels = card.querySelectorAll(
      "[aria-label], .a-color-secondary, .puis-label-popover-default"
    );
    return Array.from(labels).some((element) =>
      /^(sponsored|sponsorisé)$/i.test(utils.normalizeWhitespace(element.textContent))
    );
  }

  function findProductLink(card) {
    const selectors = [
      "h2 a[href]",
      "a.a-link-normal.s-no-outline[href]",
      "a[href*='/dp/']",
      "a[href*='/gp/product/']"
    ];
    for (const selector of selectors) {
      const link = card.querySelector(selector);
      if (link) {
        return link;
      }
    }
    return null;
  }

  function isMeaningfulCategoryText(value) {
    const text = utils.normalizeWhitespace(value);
    return Boolean(
      text &&
      !/^(?:subtotal|total|results?|search results?|sponsored|featured|top picks?|see all)$/i.test(
        text
      )
    );
  }

  function getBreadcrumbItems(document) {
    const container = document.querySelector(
      "#wayfinding-breadcrumbs_feature_div, #wayfinding-breadcrumbs_container, .a-breadcrumb"
    );
    return container
      ? Array.from(container.querySelectorAll("li"))
          .map((item) =>
            utils.normalizeWhitespace(item.textContent).replace(/^›|›$/g, "").trim()
          )
          .filter(
            (item) =>
              isMeaningfulCategoryText(item) &&
              !/^any department$/i.test(item)
          )
      : [];
  }

  function getSearchQuery(pageUrl) {
    try {
      const url = new URL(pageUrl);
      return url.pathname === "/s"
        ? utils.normalizeWhitespace(url.searchParams.get("k"))
        : "";
    } catch {
      return "";
    }
  }

  function getListingContext(document, pageUrl) {
    const searchQuery = getSearchQuery(pageUrl);
    if (searchQuery) {
      return {
        categoryName: `Search: ${searchQuery}`,
        categoryPath: `Amazon Search›${searchQuery}`
      };
    }

    const items = getBreadcrumbItems(document);
    const heading = Array.from(document.querySelectorAll("h1"))
      .map((element) => utils.normalizeWhitespace(element.textContent))
      .find(isMeaningfulCategoryText);
    const pageTitle = utils
      .normalizeWhitespace(document.title)
      .replace(/\s*[-|]\s*Amazon\.(?:in|com).*$/i, "")
      .trim();
    const categoryName =
      heading ||
      items[items.length - 1] ||
      (isMeaningfulCategoryText(pageTitle) ? pageTitle : "") ||
      "Amazon Listing";
    if (
      categoryName &&
      !items.some((item) => item.toLowerCase() === categoryName.toLowerCase())
    ) {
      items.push(categoryName);
    }
    return {
      categoryName,
      categoryPath: items.join("›") || categoryName
    };
  }

  function parseListing(document, pageUrl) {
    const cards = document.querySelectorAll(
      "[data-component-type='s-search-result'][data-asin], [data-asin]:not([data-asin=''])"
    );
    const products = [];
    const seen = new Set();

    for (const card of cards) {
      if (isSponsored(card)) {
        continue;
      }

      const link = findProductLink(card);
      const rawUrl = link?.getAttribute("href") || "";
      const asin = (
        card.getAttribute("data-asin") ||
        utils.getAsinFromUrl(rawUrl)
      ).toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(asin) || seen.has(asin)) {
        continue;
      }

      const url = utils.canonicalProductUrl(rawUrl, asin, pageUrl);
      if (!url) {
        continue;
      }

      const title =
        utils.normalizeWhitespace(card.querySelector("h2")?.textContent) ||
        utils.normalizeWhitespace(link?.textContent);
      seen.add(asin);
      products.push({ asin, title, url });
    }

    const nextElement = document.querySelector(
      "a.s-pagination-next:not(.s-pagination-disabled), a[aria-label='Go to next page']"
    );
    const nextUrl = nextElement
      ? utils.toAmazonUrl(nextElement.getAttribute("href"), pageUrl)
      : "";
    const { categoryName, categoryPath } = getListingContext(document, pageUrl);

    return { products, nextUrl, categoryName, categoryPath };
  }

  const parser = { parseListing };
  root.AZScraper = root.AZScraper || {};
  root.AZScraper.listingParser = parser;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = parser;
  }
})(globalThis);
