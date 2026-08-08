importScripts("shared/messages.js", "shared/utils.js");

const { messages, utils } = globalThis.AZScraper;
const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/12JfxDejTWTMsOUlnVANQsnjsIg27UE82_9KuFbeZq-k/edit";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwqx6L8KfzN9ipamg-gW4_xzaawqmM_bDIG8o8rADTDqJ7zpBSp6hh_5b7_g90Xd00N/exec";
const CONTENT_FILES = [
  "src/shared/messages.js",
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
  runId: "",
  sourceTabId: null,
  marketplace: "amazon.in",
  products: [],
  summary: null,
  sheetUrl: DEFAULT_SHEET_URL
});
const fallbackTabs = new Map();

async function getState() {
  const stored = await chrome.storage.session.get("runState");
  return stored.runState || { ...DEFAULT_STATE };
}

async function setState(patch) {
  const current = await getState();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.session.set({ runState: next });
  chrome.runtime.sendMessage({ type: "STATE_UPDATED", state: next }).catch(() => undefined);
  return next;
}

function isAmazonPage(value, marketplace) {
  return (
    utils.getMarketplaceFromUrl(value) === marketplace &&
    new URL(value).protocol === "https:"
  );
}

async function sendToContent(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function startRun() {
  const current = await getState();
  if (current.status === "running" || current.status === "uploading") {
    throw new Error("Ek scraping run already chalu chhe.");
  }

  const settings = (await chrome.storage.local.get("settings")).settings || {};
  const marketplace = ["amazon.in", "amazon.com"].includes(settings.marketplace)
    ? settings.marketplace
    : "amazon.in";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isAmazonPage(tab.url, marketplace)) {
    throw new Error(
      `Pehla selected ${marketplace} category ke search listing page open karo.`
    );
  }

  const runId = crypto.randomUUID();
  await setState({
    ...DEFAULT_STATE,
    status: "running",
    phase: "listing",
    message: "Amazon listing collect thai rahyu chhe...",
    runId,
    sourceTabId: tab.id,
    marketplace,
    startedAt: new Date().toISOString()
  });

  try {
    const response = await sendToContent(tab.id, {
      type: messages.SCRAPE_START,
      runId,
      limit: 50
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Amazon page scraper start na thayu.");
    }
  } catch (error) {
    await setState({ status: "failed", phase: "failed", error: error.message });
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
    error: ""
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
        finish(new Error("Fallback product tab close thayu."));
      }
    }
    const timeout = setTimeout(() => {
      finish(new Error("Fallback product tab load timeout."));
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(updatedListener);
    chrome.tabs.onRemoved.addListener(removedListener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        finish();
      }
    }).catch(() => finish(new Error("Fallback product tab available nathi.")));
  });
}

async function parseInFallbackTab(product, runId) {
  let tab;
  try {
    const state = await getState();
    if (state.status !== "running" || state.runId !== runId) {
      throw new Error("Scraping run active nathi.");
    }
    tab = await chrome.tabs.create({ url: product.url, active: false });
    const runTabs = fallbackTabs.get(runId) || new Set();
    runTabs.add(tab.id);
    fallbackTabs.set(runId, runTabs);
    const latestState = await getState();
    if (latestState.status !== "running" || latestState.runId !== runId) {
      throw new Error("Scraping run cancel thayu.");
    }
    await waitForTabComplete(tab.id);
    const response = await sendToContent(tab.id, {
      type: messages.PARSE_CURRENT_PRODUCT,
      expectedAsin: product.asin
    });
    if (!response?.ok) {
      throw new Error("Fallback tab parse na thayu.");
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

function buildPayload(state, products) {
  const runTimestamp = new Date().toISOString();
  return {
    token: state.token || "",
    runId: state.runId,
    runTimestamp,
    marketplace: state.marketplace,
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
        state.marketplace || utils.getMarketplaceFromUrl(product.productUrl)
    }))
  };
}

async function uploadPayload(payload) {
  const settings = (await chrome.storage.local.get("settings")).settings || {};
  payload.token = settings.token || "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Google Sheet upload 30 seconds pachi timeout thayu.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Apps Script invalid response aapyu (HTTP ${response.status}).`);
  }
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Google Sheet upload HTTP ${response.status}`);
  }
  return result;
}

function batchSummary(products, result) {
  return {
    processed: products.length,
    added: result.rowsAdded || 0,
    updated: result.rowsUpdated || 0,
    failed: products.filter((product) => product.status !== "ok").length,
    missingPrice: products.filter((product) => !Number.isFinite(product.priceValue)).length,
    missingBought: products.filter((product) => !Number.isFinite(product.boughtCount)).length
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
    missingBought: (base.missingBought || 0) + addition.missingBought
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
  const nextState = await setState({
    status: isFinal ? "uploading" : "running",
    phase: "upload",
    message: `${products.length} products progressive Sheet save thai rahya chhe...`,
    categoryUrl: message.categoryUrl,
    categoryName: message.categoryName,
    categoryPath: message.categoryPath,
    products,
    error: ""
  });

  try {
    const result = products.length
      ? await uploadPayload(buildPayload(nextState, products))
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
        ? summaryMessage(summary)
        : `${summary.processed} products Sheetma safely save thaya.`,
      summary,
      sheetUrl,
      products: []
    });
    return { result, summary, sheetUrl };
  } catch (error) {
    await setState({
      status: "upload_failed",
      phase: "upload_failed",
      message: "Progressive Sheet save fail thayu. Pending batch mate Retry Upload dabavo.",
      error: error.message,
      products
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
    throw new Error("Retry mate pending scraped data nathi.");
  }
  await setState({
    status: "uploading",
    phase: "upload",
    message: "Google Sheet upload fari try thai rahyu chhe...",
    error: ""
  });
  try {
    const result = await uploadPayload(buildPayload(state, state.products));
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
      products: []
    });
  } catch (error) {
    await setState({
      status: "upload_failed",
      phase: "upload_failed",
      message: "Sheet upload fari fail thayu.",
      error: error.message
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
    getState().then((state) => sendResponse({ ok: true, state }));
    return true;
  }
  if (message.type === messages.START_RUN) {
    startRun()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === messages.CANCEL_RUN) {
    cancelRun().then((state) => sendResponse({ ok: true, state }));
    return true;
  }
  if (message.type === messages.RETRY_UPLOAD) {
    retryUpload()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
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
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === messages.SCRAPE_BATCH) {
    saveBatch(message, false)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === messages.SCRAPE_COMPLETE) {
    completeRun(message)
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        const current = await getState();
        if (current.status !== "upload_failed") {
          await setState({
            status: "failed",
            phase: "failed",
            message: "Run finalize na thayu.",
            error: error.message
          });
        }
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }
  if (message.type === messages.SCRAPE_FAILED) {
    getState()
      .then((state) => {
        if (state.runId === message.runId && state.status === "running") {
          return setState({
            status: message.canceled ? "canceled" : "failed",
            phase: message.canceled ? "canceled" : "failed",
            message: message.canceled ? "Scraping cancel thayu." : "Scraping fail thayu.",
            error: message.canceled ? "" : message.error
          });
        }
        return state;
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === messages.FALLBACK_PRODUCT) {
    parseInFallbackTab(message.product, message.runId)
      .then((product) => sendResponse({ ok: true, product }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  getState().then((state) => {
    if (state.status === "running" && state.sourceTabId === tabId) {
      setState({
        status: "failed",
        phase: "failed",
        message: "Source Amazon tab close thai gayu.",
        error: "Category tab open rakhi fari Start Scraping karo."
      });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") {
    return;
  }
  getState().then((state) => {
    if (state.status === "running" && state.sourceTabId === tabId) {
      setState({
        status: "failed",
        phase: "failed",
        message: "Source Amazon tab navigate/refresh thayu.",
        error: "Category page stable hoy tyare fari Start Scraping karo."
      });
    }
  });
});
