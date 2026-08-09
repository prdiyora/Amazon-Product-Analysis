importScripts("shared/messages.js", "shared/errors.js", "shared/utils.js");

const { errors, messages, utils } = globalThis.AZScraper;
const SOURCE_MODES = new Set(["category", "brand", "product"]);
const CONTENT_FILES = [
  "src/shared/messages.js",
  "src/shared/errors.js",
  "src/shared/utils.js",
  "src/parsers/listing-parser.js",
  "src/parsers/product-parser.js",
  "src/content.js"
];
const DEFAULT_STATE = Object.freeze({
  status: "idle",
  phase: "ready",
  current: 0,
  total: 50,
  message: "Selected Amazon marketplace ni category page open kari Start dabavo.",
  error: "",
  errorDetails: null,
  runId: "",
  sourceTabId: null,
  marketplace: "amazon.in",
  analysisName: "",
  analysisTabName: "",
  sourceMode: "category",
  searchQuery: "",
  products: [],
  summary: null,
  sheetUrl: "",
  sheetEndpoint: ""
});
const fallbackTabs = new Map();

async function getState() {
  const stored = await chrome.storage.session.get("runState");
  const state = stored.runState || { ...DEFAULT_STATE };
  return state.sheetUrl && !state.sheetEndpoint
    ? { ...state, sheetUrl: "" }
    : state;
}

async function setState(patch) {
  const current = await getState();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.session.set({ runState: next });
  chrome.runtime.sendMessage({ type: "STATE_UPDATED", state: next }).catch(() => undefined);
  return next;
}

async function setFailureState(error, options = {}) {
  const errorDetails = errors.serialize(error, {
    code: options.code,
    stage: options.stage,
    message: options.errorMessage
  });
  return setState({
    status: options.status || "failed",
    phase: options.phase || "failed",
    message: options.message || "Analysis fail thayu.",
    error: errorDetails.message,
    errorDetails,
    ...(options.patch || {})
  });
}

function errorResponse(error, fallback = {}) {
  const errorDetails = errors.serialize(error, fallback);
  return {
    ok: false,
    error: errorDetails.message,
    errorDetails
  };
}

function isAmazonPage(value, marketplace) {
  return (
    utils.getMarketplaceFromUrl(value) === marketplace &&
    new URL(value).protocol === "https:"
  );
}

function getSourceMode(settings) {
  return SOURCE_MODES.has(settings.sourceMode) ? settings.sourceMode : "category";
}

function sourceLabel(sourceMode, searchQuery, fallbackName, fallbackPath) {
  if (sourceMode === "brand") {
    return {
      categoryName: `Brand search: ${searchQuery}`,
      categoryPath: `Brand search > ${searchQuery}`
    };
  }
  if (sourceMode === "product") {
    return {
      categoryName: `Product search: ${searchQuery}`,
      categoryPath: `Product search > ${searchQuery}`
    };
  }
  return {
    categoryName: fallbackName,
    categoryPath: fallbackPath
  };
}

async function sendToContent(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      throw errors.create(
        `Amazon tab sathe extension connect na thai: ${error.message}`,
        {
          code: "CONTENT_SCRIPT_CONNECTION_FAILED",
          stage: "setup",
          hint: "Amazon page reload kari extension fari start karo."
        }
      );
    }
  }
}

async function startRun() {
  const current = await getState();
  if (current.status === "running" || current.status === "uploading") {
    throw errors.create("Ek scraping run already chalu chhe.", {
      code: "RUN_ALREADY_ACTIVE",
      stage: "setup",
      hint: "Current run complete karo athva Cancel dabavo."
    });
  }

  const settings = (await chrome.storage.local.get("settings")).settings || {};
  const marketplace = ["amazon.in", "amazon.com"].includes(settings.marketplace)
    ? settings.marketplace
    : "amazon.in";
  const endpoint = String(settings.endpoint || "").trim();
  const analysisValidation = utils.validateOptionalAnalysisName(
    settings.analysisName
  );
  const sourceMode = getSourceMode(settings);
  const searchQuery = utils.normalizeWhitespace(settings.searchQuery);

  if (!endpoint) {
    throw errors.create("Apps Script Web App URL required chhe.", {
      code: "APPS_SCRIPT_URL_MISSING",
      stage: "setup",
      hint: "Tamari public Apps Script deployment ni /exec URL paste karo."
    });
  }
  if (!utils.isAppsScriptEndpoint(endpoint)) {
    throw errors.create("Apps Script Web App URL invalid chhe.", {
      code: "APPS_SCRIPT_URL_INVALID",
      stage: "setup",
      hint: "URL https://script.google.com/macros/s/.../exec format ma hovi joie."
    });
  }
  if (!analysisValidation.valid) {
    throw errors.create(analysisValidation.message, {
      code: analysisValidation.code,
      stage: "setup",
      hint: "Analysis tab name blank rakho athva valid custom name enter karo."
    });
  }
  if (sourceMode !== "category" && !searchQuery) {
    throw errors.create("Search keyword required chhe.", {
      code: "SEARCH_QUERY_MISSING",
      stage: "setup",
      hint: "Brand athva product name enter kari pehla Amazon search open karo."
    });
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isAmazonPage(tab.url, marketplace)) {
    throw errors.create(
      `Pehla selected ${marketplace} category ke search listing page open karo.`,
      {
        code: "INVALID_AMAZON_TAB",
        stage: "setup",
        hint: `Active tab ${marketplace} listing/search page hovu joie.`
      }
    );
  }
  if (
    sourceMode !== "category" &&
    !utils.isMatchingAmazonSearch(tab.url, marketplace, searchQuery)
  ) {
    throw errors.create(
      `Active Amazon page "${searchQuery}" search result nathi.`,
      {
        code: "SEARCH_PAGE_MISMATCH",
        stage: "setup",
        hint: "Open Amazon search dabavo, result page open thay pachi popup fari open karo."
      }
    );
  }

  const runId = crypto.randomUUID();
  await setState({
    ...DEFAULT_STATE,
    status: "running",
    phase: "listing",
    message:
      sourceMode === "category"
        ? "Amazon category listing collect thai rahyu chhe..."
        : `${sourceMode === "brand" ? "Brand" : "Product"} search results collect thai rahya chhe...`,
    runId,
    sourceTabId: tab.id,
    marketplace,
    analysisName: analysisValidation.name,
    analysisTabName: utils.buildAnalysisTabName(
      analysisValidation.name,
      marketplace
    ),
    sourceMode,
    searchQuery,
    startedAt: new Date().toISOString(),
    errorDetails: null
  });

  try {
    const response = await sendToContent(tab.id, {
      type: messages.SCRAPE_START,
      runId,
      limit: 50
    });
    if (!response?.ok) {
      throw response?.errorDetails
        ? errors.fromDetails(response.errorDetails)
        : errors.create(response?.error || "Amazon page scraper start na thayu.", {
            code: "SCRAPER_START_FAILED",
            stage: "setup"
          });
    }
  } catch (error) {
    await setFailureState(error, {
      message: "Amazon page par analysis start na thayu.",
      code: "SCRAPER_START_FAILED",
      stage: "setup"
    });
    throw error;
  }

  return getState();
}

async function cancelRun() {
  const state = await getState();
  if (state.status !== "running") {
    return state;
  }

  if (state.sourceTabId) {
    await chrome.tabs
      .sendMessage(state.sourceTabId, {
        type: messages.SCRAPE_CANCEL,
        runId: state.runId
      })
      .catch(() => undefined);
  }
  const canceledState = await setState({
    status: "canceled",
    phase: "canceled",
    message: "Scraping cancel thayu.",
    error: "",
    errorDetails: null
  });
  const tabs = Array.from(fallbackTabs.get(state.runId) || []);
  await Promise.all(tabs.map((tabId) => chrome.tabs.remove(tabId).catch(() => undefined)));
  return canceledState;
}

function waitForTabComplete(tabId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(updatedListener);
      chrome.tabs.onRemoved.removeListener(removedListener);
    }
    function finish(error) {
      cleanup();
      error ? reject(error) : resolve();
    }
    function updatedListener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish();
      }
    }
    function removedListener(removedTabId) {
      if (removedTabId === tabId) {
        finish(
          errors.create("Fallback product tab close thayu.", {
            code: "FALLBACK_TAB_CLOSED",
            stage: "product_fallback"
          })
        );
      }
    }
    const timeout = setTimeout(() => {
      finish(
        errors.create("Fallback product tab load timeout.", {
          code: "FALLBACK_TAB_TIMEOUT",
          stage: "product_fallback",
          hint: "Amazon page manually open thai chhe ke CAPTCHA ave chhe te check karo."
        })
      );
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(updatedListener);
    chrome.tabs.onRemoved.addListener(removedListener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        finish();
      }
    }).catch(() =>
      finish(
        errors.create("Fallback product tab available nathi.", {
          code: "FALLBACK_TAB_UNAVAILABLE",
          stage: "product_fallback"
        })
      )
    );
  });
}

async function parseInFallbackTab(product, runId) {
  let tab;
  try {
    const state = await getState();
    if (state.status !== "running" || state.runId !== runId) {
      throw errors.create("Scraping run active nathi.", {
        code: "RUN_NOT_ACTIVE",
        stage: "product_fallback"
      });
    }
    tab = await chrome.tabs.create({ url: product.url, active: false });
    const runTabs = fallbackTabs.get(runId) || new Set();
    runTabs.add(tab.id);
    fallbackTabs.set(runId, runTabs);
    const latestState = await getState();
    if (latestState.status !== "running" || latestState.runId !== runId) {
      throw errors.create("Scraping run cancel thayu.", {
        code: "RUN_CANCELED",
        stage: "product_fallback"
      });
    }
    await waitForTabComplete(tab.id);
    const response = await sendToContent(tab.id, {
      type: messages.PARSE_CURRENT_PRODUCT,
      expectedAsin: product.asin
    });
    if (!response?.ok) {
      throw errors.create("Fallback tab parse na thayu.", {
        code: "FALLBACK_PARSE_FAILED",
        stage: "product_fallback",
        hint: "Amazon CAPTCHA/robot check hoy to browserma manually complete karo."
      });
    }
    return response.product;
  } finally {
    if (tab?.id) {
      await chrome.tabs.remove(tab.id).catch(() => undefined);
      const runTabs = fallbackTabs.get(runId);
      runTabs?.delete(tab.id);
      if (!runTabs?.size) {
        fallbackTabs.delete(runId);
      }
    }
  }
}

async function uploadPayload(payload) {
  const settings = (await chrome.storage.local.get("settings")).settings || {};
  const endpoint = String(settings.endpoint || "").trim();
  if (!utils.isAppsScriptEndpoint(endpoint)) {
    throw errors.create("Apps Script Web App URL missing ke invalid chhe.", {
      code: "APPS_SCRIPT_URL_INVALID",
      stage: "upload",
      hint: "Tamari public Apps Script deployment ni /exec URL check karo."
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw errors.create("Google Sheet upload 30 seconds pachi timeout thayu.", {
        code: "APPS_SCRIPT_TIMEOUT",
        stage: "upload",
        hint: "Internet check kari Retry upload dabavo."
      });
    }
    throw errors.create(`Google Sheet request na thai: ${error.message}`, {
      code: "APPS_SCRIPT_NETWORK_ERROR",
      stage: "upload",
      hint: "Internet connection ane Apps Script deployment check karo."
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const responseHost = (() => {
    try {
      return new URL(response.url).hostname;
    } catch {
      return "";
    }
  })();
  const responseType = response.headers.get("content-type") || "";
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    const requiresSignIn =
      responseHost === "accounts.google.com" ||
      /accounts\.google\.com|ServiceLogin|Sign in - Google Accounts/i.test(text);
    if (requiresSignIn || [401, 403, 404].includes(response.status)) {
      throw errors.create(
        `Apps Script public JSON response na aapyu (HTTP ${response.status}).`,
        {
          code: "APPS_SCRIPT_NOT_PUBLIC",
          stage: "upload",
          httpStatus: response.status,
          responseHost,
          responseType,
          hint:
            'Apps Script deploymentma "Execute as: Me" ane "Who has access: Anyone" set karo.'
        }
      );
    }
    throw errors.create(
      `Apps Script invalid response aapyu (HTTP ${response.status}).`,
      {
        code: "APPS_SCRIPT_INVALID_RESPONSE",
        stage: "upload",
        httpStatus: response.status,
        responseHost,
        responseType,
        hint: "Deployment URL latest /exec URL chhe te check karo."
      }
    );
  }

  if (!response.ok || !result.ok) {
    const message = result.error || `Google Sheet upload HTTP ${response.status}`;
    const httpFailure = !response.ok;
    throw errors.create(message, {
      code: httpFailure
        ? "APPS_SCRIPT_HTTP_ERROR"
        : "APPS_SCRIPT_REJECTED",
      stage: "upload",
      httpStatus: response.status,
      responseHost,
      responseType,
      hint: httpFailure
        ? "Deployment URL/access ane Google service status check karo."
        : "Apps Script execution log ane Sheet access check karo."
    });
  }
  return { ...result, endpoint };
}

function batchSummary(products, result) {
  return {
    processed: products.length,
    added: result.rowsAdded || 0,
    updated: result.rowsUpdated || 0,
    failed: products.filter((product) => product.status !== "ok").length,
    missingPrice: products.filter((product) => !Number.isFinite(product.priceValue)).length,
    missingBought: products.filter((product) => !Number.isFinite(product.boughtCount)).length,
    issues: products
      .filter((product) => product.status !== "ok")
      .slice(0, 8)
      .map((product) => ({
        asin: product.asin || "Unknown ASIN",
        status: product.status || "incomplete",
        error: product.error || "Product details incomplete."
      }))
  };
}

function mergeSummary(current, addition) {
  const base = current || {};
  return {
    processed: (base.processed || 0) + addition.processed,
    added: (base.added || 0) + addition.added,
    updated: (base.updated || 0) + addition.updated,
    failed: (base.failed || 0) + addition.failed,
    missingPrice: (base.missingPrice || 0) + addition.missingPrice,
    missingBought: (base.missingBought || 0) + addition.missingBought,
    issues: [...(base.issues || []), ...(addition.issues || [])].slice(0, 8)
  };
}

function summaryMessage(summary) {
  return `${summary.processed} processed: ${summary.added} new, ${summary.updated} updated, ${summary.failed} failed.`;
}

function resultSheetUrl(result, fallback = "") {
  if (result.sheetUrl) {
    return result.sheetUrl;
  }
  if (result.spreadsheetUrl && result.sheetGid !== undefined) {
    const baseUrl = String(result.spreadsheetUrl).split("#")[0];
    return `${baseUrl}#gid=${result.sheetGid}`;
  }
  return fallback;
}

async function saveBatch(message, isFinal) {
  const state = await getState();
  if (state.runId !== message.runId || state.status !== "running") {
    return;
  }

  const products = [...message.products].sort(utils.compareProducts);
  const context = sourceLabel(
    state.sourceMode,
    state.searchQuery,
    message.categoryName,
    message.categoryPath
  );
  const nextState = await setState({
    status: isFinal ? "uploading" : "running",
    phase: "upload",
    message: `${products.length} products progressive Sheet save thai rahya chhe...`,
    categoryUrl: message.categoryUrl,
    categoryName: context.categoryName,
    categoryPath: context.categoryPath,
    products,
    error: "",
    errorDetails: null
  });

  try {
    const result = products.length
      ? await uploadPayload(utils.buildUploadPayload(nextState, products))
      : { rowsAdded: 0, rowsUpdated: 0, sheetUrl: state.sheetUrl || "" };
    const summary = mergeSummary(
      state.summary,
      batchSummary(products, result)
    );
    const sheetUrl = resultSheetUrl(result, state.sheetUrl || "");
    const latestState = await getState();
    if (
      latestState.runId !== message.runId ||
      !["running", "uploading"].includes(latestState.status)
    ) {
      return { result, summary, sheetUrl };
    }
    await setState({
      status: isFinal ? "complete" : "running",
      phase: isFinal ? "complete" : "products",
      message: isFinal
        ? `${summaryMessage(summary)} Saved to ${state.analysisTabName}.`
        : `${summary.processed} products Sheetma safely save thaya.`,
      summary,
      sheetUrl,
      sheetEndpoint: result.endpoint || state.sheetEndpoint || "",
      products: [],
      error: "",
      errorDetails: null
    });
    return { result, summary, sheetUrl };
  } catch (error) {
    await setFailureState(error, {
      status: "upload_failed",
      phase: "upload_failed",
      message: "Progressive Sheet save fail thayu. Pending batch mate Retry Upload dabavo.",
      code: "SHEET_UPLOAD_FAILED",
      stage: "upload",
      patch: { products }
    });
    throw error;
  }
}

async function completeRun(message) {
  return saveBatch(message, true);
}

async function retryUpload() {
  const state = await getState();
  if (state.status !== "upload_failed" || !state.products?.length) {
    throw errors.create("Retry mate pending scraped data nathi.", {
      code: "NO_PENDING_UPLOAD",
      stage: "upload"
    });
  }
  await setState({
    status: "uploading",
    phase: "upload",
    message: "Google Sheet upload fari try thai rahyu chhe...",
    error: "",
    errorDetails: null
  });
  try {
    const result = await uploadPayload(
      utils.buildUploadPayload(state, state.products)
    );
    const summary = mergeSummary(
      state.summary,
      batchSummary(state.products, result)
    );
    return setState({
      status: "complete",
      phase: "complete",
      message: summaryMessage(summary),
      summary,
      sheetUrl: resultSheetUrl(result, state.sheetUrl || ""),
      sheetEndpoint: result.endpoint || state.sheetEndpoint || "",
      products: [],
      error: "",
      errorDetails: null
    });
  } catch (error) {
    await setFailureState(error, {
      status: "upload_failed",
      phase: "upload_failed",
      message: "Sheet upload fari fail thayu.",
      code: "SHEET_RETRY_FAILED",
      stage: "upload"
    });
    throw error;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.session.get("runState");
  if (!current.runState) {
    await chrome.storage.session.set({ runState: { ...DEFAULT_STATE } });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === messages.GET_STATE) {
    getState()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) =>
        sendResponse(
          errorResponse(error, {
            code: "STATE_READ_FAILED",
            stage: "extension_state"
          })
        )
      );
    return true;
  }
  if (message.type === messages.START_RUN) {
    startRun()
      .then((state) => sendResponse({ ok: true, state }))
      .catch(async (error) => {
        if (error.code !== "RUN_ALREADY_ACTIVE") {
          await setFailureState(error, {
            message: "Analysis start na thayu.",
            code: "START_FAILED",
            stage: "setup"
          });
        }
        sendResponse(errorResponse(error, { code: "START_FAILED", stage: "setup" }));
      });
    return true;
  }
  if (message.type === messages.CANCEL_RUN) {
    cancelRun()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) =>
        sendResponse(
          errorResponse(error, { code: "CANCEL_FAILED", stage: "cancel" })
        )
      );
    return true;
  }
  if (message.type === messages.RETRY_UPLOAD) {
    retryUpload()
      .then((state) => sendResponse({ ok: true, state }))
      .catch(async (error) => {
        const state = await getState();
        sendResponse({
          ...errorResponse(error, {
            code: "SHEET_RETRY_FAILED",
            stage: "upload"
          }),
          state
        });
      });
    return true;
  }
  if (message.type === messages.SCRAPE_PROGRESS) {
    getState()
      .then((state) => {
        if (state.runId === message.runId && state.status === "running") {
          return setState({
            phase: message.phase,
            current: message.current,
            total: message.total,
            message: message.message
          });
        }
        return state;
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse(
          errorResponse(error, {
            code: "PROGRESS_UPDATE_FAILED",
            stage: "extension_state"
          })
        )
      );
    return true;
  }
  if (message.type === messages.SCRAPE_BATCH) {
    saveBatch(message, false)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse(
          errorResponse(error, { code: "SHEET_UPLOAD_FAILED", stage: "upload" })
        )
      );
    return true;
  }
  if (message.type === messages.SCRAPE_COMPLETE) {
    completeRun(message)
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        const current = await getState();
        if (current.status !== "upload_failed") {
          await setFailureState(error, {
            message: "Run finalize na thayu.",
            code: "RUN_FINALIZE_FAILED",
            stage: "finalize"
          });
        }
        sendResponse(
          errorResponse(error, { code: "RUN_FINALIZE_FAILED", stage: "finalize" })
        );
      });
    return true;
  }
  if (message.type === messages.SCRAPE_FAILED) {
    getState()
      .then(async (state) => {
        if (state.runId === message.runId && state.status === "running") {
          if (message.canceled) {
            return setState({
              status: "canceled",
              phase: "canceled",
              message: "Scraping cancel thayu.",
              error: "",
              errorDetails: null
            });
          }
          return setFailureState(message.errorDetails || message.error, {
            message: "Scraping fail thayu.",
            code: "SCRAPE_FAILED",
            stage: "scrape"
          });
        }
        return state;
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse(
          errorResponse(error, {
            code: "SCRAPE_FAILURE_STATE_FAILED",
            stage: "extension_state"
          })
        )
      );
    return true;
  }
  if (message.type === messages.FALLBACK_PRODUCT) {
    parseInFallbackTab(message.product, message.runId)
      .then((product) => sendResponse({ ok: true, product }))
      .catch((error) =>
        sendResponse(
          errorResponse(error, {
            code: "FALLBACK_PRODUCT_FAILED",
            stage: "product_fallback"
          })
        )
      );
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  getState().then((state) => {
    if (state.status === "running" && state.sourceTabId === tabId) {
      setFailureState(
        errors.create("Category tab open rakhi fari Start analysis karo.", {
          code: "SOURCE_TAB_CLOSED",
          stage: "scrape",
          hint: "Analysis complete thay tya sudhi source Amazon tab open rakho."
        }),
        {
          message: "Source Amazon tab close thai gayu.",
          code: "SOURCE_TAB_CLOSED",
          stage: "scrape"
        }
      );
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") {
    return;
  }
  getState().then((state) => {
    if (state.status === "running" && state.sourceTabId === tabId) {
      setFailureState(
        errors.create("Source category page manually refresh/change thayu.", {
          code: "SOURCE_PAGE_CHANGED",
          stage: "scrape",
          hint:
            "Run darmiyan original category tab unchanged rakho. Extension pote product tabs open kare te normal chhe."
        }),
        {
          message: "Source Amazon category page change thayu.",
          code: "SOURCE_PAGE_CHANGED",
          stage: "scrape"
        }
      );
    }
  });
});
