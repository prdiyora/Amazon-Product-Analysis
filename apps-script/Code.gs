const SPREADSHEET_ID_PROPERTY = "AZ_SCRAPER_SPREADSHEET_ID";
const ANALYSIS_NAME_MAX_LENGTH = 94;
const DEFAULT_SHEET_NAMES = {
  "amazon.in": "Amazon Products IN",
  "amazon.com": "Amazon Products USA"
};
const HEADERS = [
  "Run Timestamp",
  "Category URL",
  "Category Name",
  "Category Path",
  "ASIN",
  "Title",
  "Brand",
  "Product URL",
  "Price",
  "Price Value",
  "Currency",
  "Rating",
  "Review Count",
  "Bought Text",
  "Bought Count",
  "Status",
  "Error",
  "Marketplace"
];
const LEGACY_HEADERS = [
  "Run Timestamp",
  "Category URL",
  "Category Name",
  "ASIN",
  "Title",
  "Product URL",
  "Price",
  "Price Value",
  "Currency",
  "Rating",
  "Review Count",
  "Bought Text",
  "Bought Count",
  "Status",
  "Error"
];

function configureTargetSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      "Aa Apps Script Google Sheet mathi Extensions > Apps Script dvara open karo."
    );
  }
  ensureDefaultMarketplaceSheet_(spreadsheet, "amazon.in");
  PropertiesService.getScriptProperties()
    .setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
  return "Target Sheet connected: " + spreadsheet.getName();
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse(event.postData && event.postData.contents || "{}");
    validatePayload_(payload);

    if (!lock.tryLock(30000)) {
      throw new Error("Sheet busy chhe. Thodi vaar pachi Retry Upload karo.");
    }

    const spreadsheet = getTargetSpreadsheet_();
    const result = writeProducts_(
      spreadsheet,
      payload.products,
      payload.analysisName
    );
    return jsonResponse_({
      ok: true,
      rowsAdded: result.rowsAdded,
      rowsUpdated: result.rowsUpdated,
      sheetUrl: result.sheetUrl,
      spreadsheetUrl: result.spreadsheetUrl,
      sheetGid: result.sheetGid
    });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function getTargetSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) {
    throw new Error(
      "Target Sheet configured nathi. Apps Script editor mathi configureTargetSpreadsheet function ek var Run karo."
    );
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function validatePayload_(payload) {
  const expectedToken = PropertiesService.getScriptProperties()
    .getProperty("AZ_SCRAPER_TOKEN");
  if (expectedToken && payload.token !== expectedToken) {
    throw new Error("Invalid shared token.");
  }
  if (!Array.isArray(payload.products) || payload.products.length === 0) {
    throw new Error("Products payload missing chhe.");
  }
  if (payload.products.length > 50) {
    throw new Error("Maximum 50 products ek requestma allowed chhe.");
  }
  if (payload.marketplace !== "amazon.in" && payload.marketplace !== "amazon.com") {
    throw new Error("Invalid marketplace.");
  }
  payload.analysisName = validateAnalysisName_(payload.analysisName);
  const categoryMarketplace = marketplaceFromAmazonUrl_(payload.categoryUrl);
  if (categoryMarketplace !== payload.marketplace) {
    throw new Error("Category URL selected marketplace sathe match nathi thatu.");
  }
  payload.products.forEach(function(product) {
    const urlMarketplace = marketplaceFromAmazonUrl_(product.productUrl);
    if (urlMarketplace !== payload.marketplace) {
      throw new Error(
        "Product " + String(product.asin || "") +
        " nu URL selected marketplace sathe match nathi thatu."
      );
    }
    if (product.marketplace && product.marketplace !== urlMarketplace) {
      throw new Error(
        "Product " + String(product.asin || "") + " ma marketplace mismatch chhe."
      );
    }
    product.marketplace = urlMarketplace;
  });
}

function validateAnalysisName_(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  if (!name) {
    throw new Error("Analysis tab name required chhe.");
  }
  if (/[:\\/?*\[\]]/.test(name)) {
    throw new Error("Analysis name ma : \\ / ? * [ ] characters allowed nathi.");
  }
  if (name.length > ANALYSIS_NAME_MAX_LENGTH) {
    throw new Error(
      "Analysis name maximum " + ANALYSIS_NAME_MAX_LENGTH +
      " characters nu hovu joie."
    );
  }
  return name;
}

function analysisSheetName_(analysisName, marketplace) {
  const suffix = marketplace === "amazon.com" ? "USA" : "IN";
  return validateAnalysisName_(analysisName) + " - " + suffix;
}

function writeProducts_(spreadsheet, products, analysisName) {
  const groups = new Map();
  products.forEach(function(product) {
    const marketplace = marketplaceForProduct_(product);
    const marketplaceProducts = groups.get(marketplace) || [];
    marketplaceProducts.push(product);
    groups.set(marketplace, marketplaceProducts);
  });

  let rowsAdded = 0;
  let rowsUpdated = 0;
  let sheetUrl = "";
  let spreadsheetUrl = "";
  let sheetGid = "";
  groups.forEach(function(marketplaceProducts, marketplace) {
    ensureDefaultMarketplaceSheet_(spreadsheet, marketplace);
    const result = writeMarketplaceProducts_(
      spreadsheet,
      marketplace,
      marketplaceProducts,
      analysisName
    );
    rowsAdded += result.rowsAdded;
    rowsUpdated += result.rowsUpdated;
    sheetUrl = result.sheetUrl || sheetUrl;
    spreadsheetUrl = result.spreadsheetUrl || spreadsheetUrl;
    sheetGid = result.sheetGid || sheetGid;
  });
  return {
    rowsAdded: rowsAdded,
    rowsUpdated: rowsUpdated,
    sheetUrl: sheetUrl,
    spreadsheetUrl: spreadsheetUrl,
    sheetGid: sheetGid
  };
}

function writeMarketplaceProducts_(
  spreadsheet,
  marketplace,
  products,
  analysisName
) {
  const sheetName = analysisSheetName_(analysisName, marketplace);
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  ensureHeaders_(sheet, HEADERS);

  const incomingByKey = new Map();
  const unkeyedRows = [];
  products.forEach(function(product) {
    const row = [
      safeCell_(product.runTimestamp),
      safeCell_(product.categoryUrl),
      safeCell_(product.categoryName),
      safeCell_(product.categoryPath),
      safeCell_(product.asin),
      safeCell_(product.title),
      safeCell_(product.brand),
      safeCell_(product.productUrl),
      safeCell_(product.priceText),
      numberOrBlank_(product.priceValue),
      safeCell_(product.currency),
      numberOrBlank_(product.rating),
      numberOrBlank_(product.reviewCount),
      safeCell_(product.boughtText),
      numberOrBlank_(product.boughtCount),
      safeCell_(product.status),
      safeCell_(product.error),
      safeCell_(product.marketplace)
    ];
    const key = productKey_(row);
    if (key) {
      incomingByKey.set(key, row);
    } else {
      unkeyedRows.push(row);
    }
  });
  const incomingRows = Array.from(incomingByKey.values()).concat(unkeyedRows);

  const existingRowCount = Math.max(sheet.getLastRow() - 1, 0);
  const existingRows = existingRowCount
    ? sheet.getRange(2, 1, existingRowCount, HEADERS.length).getValues()
    : [];
  const existingIndexByKey = new Map();
  existingRows.forEach(function(row, index) {
    const key = productKey_(row);
    if (key && !existingIndexByKey.has(key)) {
      existingIndexByKey.set(key, index);
    }
  });

  const newRows = [];
  let rowsUpdated = 0;
  incomingRows.forEach(function(row) {
    const key = productKey_(row);
    if (key && existingIndexByKey.has(key)) {
      existingRows[existingIndexByKey.get(key)] = row;
      rowsUpdated += 1;
    } else {
      newRows.push(row);
      if (key) {
        existingIndexByKey.set(key, existingRows.length + newRows.length - 1);
      }
    }
  });

  const allRows = existingRows.concat(newRows);
  allRows.sort(compareProductRows_);
  if (allRows.length) {
    sheet.getRange(2, 1, allRows.length, HEADERS.length)
      .setValues(allRows);
  }
  return {
    rowsAdded: newRows.length,
    rowsUpdated: rowsUpdated,
    sheetUrl: sheetUrl_(spreadsheet, sheet),
    spreadsheetUrl:
      typeof spreadsheet.getUrl === "function" ? spreadsheet.getUrl() : "",
    sheetGid:
      typeof sheet.getSheetId === "function" ? String(sheet.getSheetId()) : ""
  };
}

function sheetUrl_(spreadsheet, sheet) {
  if (
    typeof spreadsheet.getUrl !== "function" ||
    typeof sheet.getSheetId !== "function"
  ) {
    return "";
  }
  return spreadsheet.getUrl() + "#gid=" + sheet.getSheetId();
}

function marketplaceForProduct_(product) {
  const marketplace = marketplaceFromAmazonUrl_(product.productUrl);
  if (!marketplace) {
    throw new Error("Unsupported Amazon product URL.");
  }
  return marketplace;
}

function marketplaceFromAmazonUrl_(value) {
  const match = String(value || "").match(
    /^https:\/\/(?:www\.)?amazon\.(in|com)(?:\/|$)/i
  );
  return match ? "amazon." + match[1].toLowerCase() : "";
}

function compareProductRows_(left, right) {
  const leftBought = finiteNumberOr_(left[14], -1);
  const rightBought = finiteNumberOr_(right[14], -1);
  if (leftBought !== rightBought) {
    return rightBought - leftBought;
  }

  const leftReviews = finiteNumberOr_(left[12], Number.POSITIVE_INFINITY);
  const rightReviews = finiteNumberOr_(right[12], Number.POSITIVE_INFINITY);
  if (leftReviews !== rightReviews) {
    return leftReviews - rightReviews;
  }
  return String(left[4] || "").localeCompare(String(right[4] || ""));
}

function finiteNumberOr_(value, fallback) {
  return typeof value === "number" && isFinite(value) ? value : fallback;
}

function productKey_(row) {
  const marketplace = marketplaceForRow_(row);
  const asin = String(row[4] || "").trim().toUpperCase();
  if (asin) {
    return marketplace + ":ASIN:" + asin;
  }
  const productUrl = String(row[7] || "").trim().toLowerCase();
  return productUrl ? marketplace + ":URL:" + productUrl : "";
}

function marketplaceForRow_(row) {
  const value = String(row[17] || "").trim().toLowerCase();
  if (value === "amazon.in" || value === "amazon.com") {
    return value;
  }
  const productUrl = String(row[7] || "").toLowerCase();
  return /(?:www\.)?amazon\.com\//.test(productUrl) ? "amazon.com" : "amazon.in";
}

function ensureDefaultMarketplaceSheet_(spreadsheet, marketplace) {
  const sheetName =
    DEFAULT_SHEET_NAMES[marketplace] || DEFAULT_SHEET_NAMES["amazon.in"];
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  ensureHeaders_(sheet, HEADERS);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasCurrentSchema = headers.every(function(header, index) {
    return currentHeaders[index] === header;
  });
  if (hasCurrentSchema) {
    if (hasPopulatedColumnsAfter_(sheet, headers.length)) {
      throwSchemaConflict_(sheet, "analysis columns pachi extra data chhe");
    }
    sheet.setFrozenRows(1);
    return;
  }

  const hasLegacySchema = LEGACY_HEADERS.every(function(header, index) {
    return currentHeaders[index] === header;
  });
  if (hasLegacySchema) {
    if (hasPopulatedColumnsAfter_(sheet, LEGACY_HEADERS.length)) {
      throwSchemaConflict_(sheet, "legacy columns pachi extra data chhe");
    }
    sheet.insertColumnAfter(3);
    sheet.insertColumnAfter(6);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  throwSchemaConflict_(sheet, "compatible analysis headers nathi");
}

function hasPopulatedColumnsAfter_(sheet, columnCount) {
  if (typeof sheet.getLastColumn !== "function") {
    return false;
  }
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastColumn <= columnCount || lastRow === 0) {
    return false;
  }
  const values = sheet
    .getRange(1, columnCount + 1, lastRow, lastColumn - columnCount)
    .getValues();
  return values.some(function(row) {
    return row.some(function(value) {
      return String(value == null ? "" : value).trim() !== "";
    });
  });
}

function throwSchemaConflict_(sheet, reason) {
  const sheetName =
    typeof sheet.getName === "function" ? sheet.getName() : "requested";
  throw new Error(
    'Sheet tab "' + sheetName + '" ma ' + reason +
    ". Biju Analysis tab name use karo."
  );
}

function safeCell_(value) {
  const text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function numberOrBlank_(value) {
  return typeof value === "number" && isFinite(value) ? value : "";
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
