(function initContent(root) {
  if (root.AZScraper?.contentInitialized) {
    return;
  }
  root.AZScraper.contentInitialized = true;

  const { messages, utils, listingParser, productParser } = root.AZScraper;
  const PRODUCT_LIMIT = 50;
  const MAX_LISTING_PAGES = 12;
  let activeRun = null;

  function sendMessage(payload) {
    return chrome.runtime.sendMessage(payload).catch(() => undefined);
  }

  function report(runId, phase, current, total, message) {
    return sendMessage({
      type: messages.SCRAPE_PROGRESS,
      runId,
      phase,
      current,
      total,
      message
    });
  }

  async function fetchDocument(url, signal, attempts = 2) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort(signal.reason);
      signal.addEventListener("abort", abortRequest, { once: true });
      const timeout = setTimeout(() => requestController.abort(), 20_000);
      try {
        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
          signal: requestController.signal
        });
        if (!response.ok) {
          throw new Error(`Amazon HTTP ${response.status}`);
        }
        const html = await response.text();
        return new DOMParser().parseFromString(html, "text/html");
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        lastError =
          error.name === "AbortError"
            ? new Error("Amazon request 20 seconds pachi timeout thayu.")
            : error;
        if (attempt < attempts) {
          await utils.sleep(800 * attempt, signal);
        }
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abortRequest);
      }
    }
    throw lastError;
  }

  async function collectProducts(runId, signal, limit) {
    const products = new Map();
    const visitedPages = new Set();
    let pageUrl = location.href;
    let pageDocument = document;
    let categoryName = "";
    let categoryPath = "";

    for (let pageNumber = 1; pageNumber <= MAX_LISTING_PAGES && pageUrl; pageNumber += 1) {
      if (signal.aborted) {
        throw new DOMException("Scraping cancel thayu.", "AbortError");
      }
      if (visitedPages.has(pageUrl)) {
        break;
      }
      visitedPages.add(pageUrl);

      await report(
        runId,
        "listing",
        Math.min(products.size, limit),
        limit,
        `Listing page ${pageNumber} parse thai rahyu chhe...`
      );
      const parsed = listingParser.parseListing(pageDocument, pageUrl);
      categoryName ||= parsed.categoryName;
      categoryPath ||= parsed.categoryPath;
      for (const product of parsed.products) {
        products.set(product.asin, product);
        if (products.size >= limit) {
          break;
        }
      }

      if (products.size >= limit || !parsed.nextUrl) {
        break;
      }

      pageUrl = parsed.nextUrl;
      await utils.sleep(700 + Math.floor(Math.random() * 500), signal);
      pageDocument = await fetchDocument(pageUrl, signal);
    }

    return {
      products: Array.from(products.values()).slice(0, limit),
      categoryName,
      categoryPath
    };
  }

  async function fetchProduct(runId, product, signal) {
    let parsed;
    try {
      const productDocument = await fetchDocument(product.url, signal);
      parsed = productParser.parseProduct(productDocument, product.url, product.asin);
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      parsed = {
        asin: product.asin,
        productUrl: product.url,
        status: "fetch_error",
        error: error.message
      };
    }

    if (parsed.status === "ok") {
      return parsed;
    }

    const fallback = await sendMessage({
      type: messages.FALLBACK_PRODUCT,
      runId,
      product,
      reason: parsed.error
    });
    if (fallback?.ok && fallback.product) {
      return fallback.product;
    }
    return parsed;
  }

  async function scrape(runId, requestedLimit) {
    const controller = new AbortController();
    const limit = Math.min(Math.max(requestedLimit || PRODUCT_LIMIT, 1), PRODUCT_LIMIT);
    activeRun = { runId, controller };

    try {
      const collection = await collectProducts(runId, controller.signal, limit);
      if (!collection.products.length) {
        throw new Error(
          "Aa page par Amazon product cards nathi malya. Category ke search listing page open karo."
        );
      }

      const results = [];
      for (let index = 0; index < collection.products.length; index += 1) {
        if (index > 0) {
          await utils.sleep(1_200 + Math.floor(Math.random() * 1_000), controller.signal);
        }
        const product = collection.products[index];
        await report(
          runId,
          "products",
          index,
          collection.products.length,
          `Product ${index + 1}/${collection.products.length}: ${product.asin}`
        );
        const detail = await fetchProduct(runId, product, controller.signal);
        results.push({
          ...detail,
          asin: detail.asin || product.asin,
          title: detail.title || product.title,
          productUrl: detail.productUrl || product.url
        });
        if (results.length === 10) {
          const batchResponse = await sendMessage({
            type: messages.SCRAPE_BATCH,
            runId,
            categoryUrl: location.href,
            categoryName: collection.categoryName,
            categoryPath: collection.categoryPath,
            products: results.splice(0, results.length)
          });
          if (!batchResponse?.ok) {
            throw new Error(
              batchResponse?.error || "Progressive Sheet save fail thayu."
            );
          }
        }
        await report(
          runId,
          "products",
          index + 1,
          collection.products.length,
          `${index + 1}/${collection.products.length} products complete`
        );
      }

      await sendMessage({
        type: messages.SCRAPE_COMPLETE,
        runId,
        categoryUrl: location.href,
        categoryName: collection.categoryName,
        categoryPath: collection.categoryPath,
        products: results
      });
    } catch (error) {
      await sendMessage({
        type: messages.SCRAPE_FAILED,
        runId,
        canceled: error.name === "AbortError",
        error: error.message || "Unknown scraping error"
      });
    } finally {
      if (activeRun?.runId === runId) {
        activeRun = null;
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === messages.SCRAPE_START) {
      if (activeRun) {
        sendResponse({ ok: false, error: "Aa tabma scraping already chalu chhe." });
        return false;
      }

      scrape(message.runId, message.limit);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === messages.SCRAPE_CANCEL) {
      if (activeRun?.runId === message.runId) {
        activeRun.controller.abort();
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === messages.PARSE_CURRENT_PRODUCT) {
      sendResponse({
        ok: true,
        product: productParser.parseProduct(
          document,
          location.href,
          message.expectedAsin
        )
      });
      return false;
    }

    return false;
  });
})(globalThis);
