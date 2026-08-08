const SPREADSHEET_ID = "12JfxDejTWTMsOUlnVANQsnjsIg27UE82_9KuFbeZq-k";
const SCHEMA_VERSION = "only-in-usa-tabs-v4";
const SCHEMA_VERSION_PROPERTY = "AZ_SCRAPER_SCHEMA_VERSION";
const SHEET_NAMES = {
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

function resetProductSheets() {
  const spreadsheet = getTargetSpreadsheet_();

  resetSpreadsheet_(spreadsheet);
  PropertiesService.getScriptProperties()
    .setProperty(SCHEMA_VERSION_PROPERTY, SCHEMA_VERSION);
  return "Badha old tabs/data delete thai clean IN ane USA tabs create thaya.";
}

function resetOldProductDataOnce_(spreadsheet) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(SCHEMA_VERSION_PROPERTY) === SCHEMA_VERSION) {
    return;
  }
  resetSpreadsheet_(spreadsheet);
  properties.setProperty(SCHEMA_VERSION_PROPERTY, SCHEMA_VERSION);
}

function resetSpreadsheet_(spreadsheet) {
  const temporaryName = "AZ Scraper Reset " + Date.now();
  const temporarySheet = spreadsheet.insertSheet(temporaryName);
  spreadsheet.getSheets().forEach(function(sheet) {
    if (sheet.getSheetId() !== temporarySheet.getSheetId()) {
      spreadsheet.deleteSheet(sheet);
    }
  });
  Object.keys(SHEET_NAMES).forEach(function(marketplace) {
    const sheet = spreadsheet.insertSheet(SHEET_NAMES[marketplace]);
    ensureHeaders_(sheet, HEADERS);
  });
  spreadsheet.deleteSheet(temporarySheet);
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
    resetOldProductDataOnce_(spreadsheet);
    const result = writeProducts_(spreadsheet, payload.products);
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
  return SpreadsheetApp.openById(SPREADSHEET_ID);
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

function writeProducts_(spreadsheet, products) {
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
    const result = writeMarketplaceProducts_(
      spreadsheet,
      marketplace,
      marketplaceProducts
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

function writeMarketplaceProducts_(spreadsheet, marketplace, products) {
  const sheetName = SHEET_NAMES[marketplace] || SHEET_NAMES["amazon.in"];
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

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const probe = sheet.getRange(1, 1, 1, 6).getValues()[0];
  if (probe[3] === "ASIN") {
    sheet.insertColumnAfter(3);
    sheet.insertColumnAfter(6);
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
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
