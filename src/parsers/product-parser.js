(function initProductParser(root) {
  const utils =
    root.AZScraper?.utils ||
    (typeof require === "function" ? require("../shared/utils.js") : null);

  function firstText(document, selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = utils.normalizeWhitespace(
        element?.getAttribute("title") || element?.textContent
      );
      if (value) {
        return value;
      }
    }
    return "";
  }

  function getBoughtText(document) {
    const direct = firstText(document, [
      "#social-proofing-faceout-title-tk_bought",
      "#social-proofing-faceout-title",
      "[id*='social-proofing'] .a-text-bold",
      "[data-csa-c-content-id*='social-proofing']"
    ]);
    if (/\bbought\b/i.test(direct)) {
      return direct;
    }

    const candidates = document.querySelectorAll(
      "#feature-bullets span, #centerCol span, #rightCol span"
    );
    const match = Array.from(candidates).find((element) =>
      /\b[\d,.]+\s*[KML]?\+?\s+bought\b/i.test(element.textContent || "")
    );
    return utils.normalizeWhitespace(match?.textContent);
  }

  function getBrand(document) {
    const rows = document.querySelectorAll(
      "#productOverview_feature_div tr, #productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr"
    );
    for (const row of rows) {
      const cells = row.querySelectorAll("th, td");
      if (
        cells.length >= 2 &&
        /^brand$/i.test(utils.normalizeWhitespace(cells[0].textContent))
      ) {
        return utils.normalizeWhitespace(cells[cells.length - 1].textContent);
      }
    }

    return firstText(document, ["#bylineInfo"])
      .replace(/^Visit the\s+/i, "")
      .replace(/\s+Store$/i, "")
      .replace(/^Brand:\s*/i, "")
      .trim();
  }

  function isBlockedPage(document) {
    const title = utils.normalizeWhitespace(document.title);
    const bodyText = utils.normalizeWhitespace(document.body?.textContent).slice(0, 1500);
    return Boolean(
      document.querySelector("form[action*='validateCaptcha'], #captchacharacters") ||
        /robot check|enter the characters you see below|sorry, we just need to make sure/i.test(
          `${title} ${bodyText}`
        )
    );
  }

  function parseProduct(document, productUrl, expectedAsin = "") {
    if (isBlockedPage(document)) {
      return {
        asin: expectedAsin || utils.getAsinFromUrl(productUrl),
        productUrl: utils.canonicalProductUrl(productUrl, expectedAsin),
        status: "blocked",
        error: "Amazon robot check/CAPTCHA malyu."
      };
    }

    const asin = (
      document.querySelector("#ASIN")?.getAttribute("value") ||
      document.querySelector("input[name='ASIN']")?.getAttribute("value") ||
      expectedAsin ||
      utils.getAsinFromUrl(productUrl)
    ).toUpperCase();
    const title = firstText(document, ["#productTitle", "h1.a-size-large", "h1"]);
    const priceText = firstText(document, [
      "#corePrice_feature_div .a-price .a-offscreen",
      "#apex_desktop .a-price .a-offscreen",
      ".priceToPay .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice"
    ]);
    const reviewText = firstText(document, [
      "#acrCustomerReviewText",
      "[data-hook='total-review-count']"
    ]);
    const ratingText = firstText(document, [
      "#acrPopover",
      "[data-hook='rating-out-of-text']",
      "#averageCustomerReviews .a-icon-alt"
    ]);
    const boughtText = getBoughtText(document);
    const status = title ? "ok" : "incomplete";

    return {
      asin,
      title,
      brand: getBrand(document),
      productUrl: utils.canonicalProductUrl(productUrl, asin),
      priceText,
      priceValue: utils.parseDecimal(priceText),
      currency: /₹|INR/i.test(priceText)
        ? "INR"
        : /\$|USD/i.test(priceText)
          ? "USD"
          : "",
      rating: utils.parseDecimal(ratingText),
      reviewCount: utils.parseInteger(reviewText),
      boughtText,
      boughtCount: utils.parseCompactCount(boughtText),
      status,
      error: title ? "" : "Product title parse na thayu."
    };
  }

  const parser = { isBlockedPage, parseProduct };
  root.AZScraper = root.AZScraper || {};
  root.AZScraper.productParser = parser;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = parser;
  }
})(globalThis);
