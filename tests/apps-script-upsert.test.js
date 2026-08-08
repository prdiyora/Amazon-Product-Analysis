const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

class FakeSheet {
  constructor(name = "") {
    this.rows = [];
    this.name = name;
    this.id = FakeSheet.nextId++;
  }

  getLastRow() {
    return this.rows.length;
  }

  setFrozenRows() {}

  getSheetId() {
    return this.id;
  }

  insertColumnAfter(column) {
    this.rows.forEach((row) => row.splice(column, 0, ""));
  }

  getRange(startRow, startColumn, rowCount, columnCount) {
    return {
      getValues: () => {
        return Array.from({ length: rowCount }, (_, rowOffset) => {
          return Array.from({ length: columnCount }, (_, columnOffset) => {
            return this.rows[startRow - 1 + rowOffset]?.[
              startColumn - 1 + columnOffset
            ] ?? "";
          });
        });
      },
      setValues: (values) => {
        values.forEach((row, rowOffset) => {
          const targetRow = startRow - 1 + rowOffset;
          this.rows[targetRow] ||= [];
          row.forEach((value, columnOffset) => {
            this.rows[targetRow][startColumn - 1 + columnOffset] = value;
          });
        });
      }
    };
  }
}
FakeSheet.nextId = 1;

function loadAppsScript() {
  const code = readFileSync(
    join(__dirname, "..", "apps-script", "Code.gs"),
    "utf8"
  );
  const propertyValues = new Map();
  const scriptProperties = {
    getProperty: (key) => propertyValues.get(key) || null,
    setProperty: (key, value) => propertyValues.set(key, value)
  };
  const context = vm.createContext({
    Map,
    Set,
    String,
    Array,
    Math,
    JSON,
    isFinite,
    PropertiesService: {
      getScriptProperties: () => scriptProperties
    },
    __propertyValues: propertyValues
  });
  vm.runInContext(code, context);
  return context;
}

function product(
  asin,
  title,
  priceValue,
  boughtCount = 100,
  reviewCount = 10,
  marketplace = "amazon.in"
) {
  return {
    runTimestamp: "2026-08-07T00:00:00.000Z",
    categoryUrl: `https://www.${marketplace}/s?k=test`,
    categoryName: "Test",
    categoryPath: "Home & Kitchen›Test",
    asin,
    title,
    brand: "Example Brand",
    productUrl: `https://www.${marketplace}/dp/${asin}`,
    priceText: `₹${priceValue}`,
    priceValue,
    currency: marketplace === "amazon.com" ? "USD" : "INR",
    rating: 4.5,
    reviewCount,
    boughtText: `${boughtCount}+ bought in past month`,
    boughtCount,
    status: "ok",
    error: "",
    marketplace
  };
}

test("Apps Script same ASIN update kare ane only new ASIN append kare chhe", () => {
  const context = loadAppsScript();
  const sheet = new FakeSheet();
  const spreadsheet = {
    getSheetByName: () => sheet,
    insertSheet: () => sheet
  };

  const first = context.writeProducts_(spreadsheet, [
    product("B000000001", "Old title", 100),
    product("B000000002", "Second product", 200)
  ]);
  const second = context.writeProducts_(spreadsheet, [
    product("B000000001", "Latest title", 150),
    product("B000000003", "New product", 300)
  ]);

  assert.deepEqual(
    { rowsAdded: first.rowsAdded, rowsUpdated: first.rowsUpdated },
    { rowsAdded: 2, rowsUpdated: 0 }
  );
  assert.deepEqual(
    { rowsAdded: second.rowsAdded, rowsUpdated: second.rowsUpdated },
    { rowsAdded: 1, rowsUpdated: 1 }
  );
  assert.equal(sheet.rows.length, 4);
  assert.equal(sheet.rows[1][4], "B000000001");
  assert.equal(sheet.rows[1][5], "Latest title");
  assert.equal(sheet.rows[1][9], 150);
});

test("same payloadma duplicate ASIN last value sathe ek j row banave chhe", () => {
  const context = loadAppsScript();
  const sheet = new FakeSheet();
  const spreadsheet = {
    getSheetByName: () => sheet,
    insertSheet: () => sheet
  };

  const result = context.writeProducts_(spreadsheet, [
    product("B000000001", "First value", 100),
    product("B000000001", "Last value", 125)
  ]);

  assert.equal(result.rowsAdded, 1);
  assert.equal(result.rowsUpdated, 0);
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[1][5], "Last value");
  assert.equal(sheet.rows[1][9], 125);
});

test("upsert pachi whole Sheet bought highest ane reviews lowest orderma rahe chhe", () => {
  const context = loadAppsScript();
  const sheet = new FakeSheet();
  const spreadsheet = {
    getSheetByName: () => sheet,
    insertSheet: () => sheet
  };

  context.writeProducts_(spreadsheet, [
    product("B000000001", "Low bought", 100, 100, 2),
    product("B000000002", "High reviews", 200, 1000, 500),
    product("B000000003", "Low reviews", 300, 1000, 20)
  ]);

  assert.deepEqual(
    sheet.rows.slice(1).map((row) => row[4]),
    ["B000000003", "B000000002", "B000000001"]
  );
});

test("same ASIN India ane USA marketplace mate separate rows rahe chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet();
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const result = context.writeProducts_(spreadsheet, [
    product("B000000001", "India product", 100, 100, 10, "amazon.in"),
    product("B000000001", "USA product", 25, 200, 20, "amazon.com")
  ]);

  assert.equal(result.rowsAdded, 2);
  assert.equal(result.rowsUpdated, 0);
  assert.deepEqual(
    Array.from(sheets.keys()).sort(),
    ["Amazon Products IN", "Amazon Products USA"]
  );
  assert.equal(sheets.get("Amazon Products IN").rows[1][17], "amazon.in");
  assert.equal(sheets.get("Amazon Products USA").rows[1][17], "amazon.com");
});

test("existing old schema columns migrate thai ASIN update kare chhe", () => {
  const context = loadAppsScript();
  const legacySheet = new FakeSheet();
  legacySheet.rows = [
    [
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
    ],
    [
      "old timestamp",
      "old category",
      "Old",
      "B000000001",
      "Old title",
      "https://www.amazon.in/dp/B000000001",
      "₹100",
      100,
      "INR",
      4,
      10,
      "100+ bought",
      100,
      "ok",
      ""
    ]
  ];
  const sheets = new Map([["Amazon Products IN", legacySheet]]);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet();
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const result = context.writeProducts_(spreadsheet, [
    product("B000000001", "Latest India title", 150)
  ]);

  assert.equal(result.rowsAdded, 0);
  assert.equal(result.rowsUpdated, 1);
  assert.equal(sheets.get("Amazon Products IN").rows[0][3], "Category Path");
  assert.equal(sheets.get("Amazon Products IN").rows[0][6], "Brand");
  assert.equal(sheets.get("Amazon Products IN").rows[1][5], "Latest India title");
  assert.equal(sheets.get("Amazon Products IN").rows[1][17], "amazon.in");
});

test("manual reset badha old tabs delete kari only IN ane USA banave chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map(
    ["Amazon Products", "Amazon Products IN", "Amazon Products USA", "Notes"]
      .map((name) => [name, new FakeSheet(name)])
  );
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    getSheets: () => Array.from(sheets.values()),
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
    deleteSheet: (sheet) => sheets.delete(sheet.name)
  };
  context.SpreadsheetApp = {
    openById: () => spreadsheet
  };

  const result = context.resetProductSheets();

  assert.equal(
    result,
    "Badha old tabs/data delete thai clean IN ane USA tabs create thaya."
  );
  assert.deepEqual(
    Array.from(sheets.keys()).sort(),
    ["Amazon Products IN", "Amazon Products USA"]
  );
  assert.equal(sheets.get("Amazon Products IN").rows[0][0], "Run Timestamp");
  assert.equal(sheets.get("Amazon Products USA").rows[0][0], "Run Timestamp");
});

test("schema auto reset clean IN USA tabs only ek var create kare chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map(
    ["Amazon Products", "Amazon Products IN", "Amazon Products USA", "Notes"]
      .map((name) => [name, new FakeSheet(name)])
  );
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    getSheets: () => Array.from(sheets.values()),
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
    deleteSheet: (sheet) => sheets.delete(sheet.name)
  };

  context.resetOldProductDataOnce_(spreadsheet);
  assert.deepEqual(
    Array.from(sheets.keys()).sort(),
    ["Amazon Products IN", "Amazon Products USA"]
  );

  sheets.get("Amazon Products IN").rows.push(["kept"]);
  context.resetOldProductDataOnce_(spreadsheet);
  assert.equal(sheets.get("Amazon Products IN").rows[1][0], "kept");
  assert.equal(
    context.__propertyValues.get("AZ_SCRAPER_SCHEMA_VERSION"),
    "only-in-usa-tabs-v4"
  );
});

test("Apps Script exact marketplace tab URL return kare chhe", () => {
  const context = loadAppsScript();
  const sheet = new FakeSheet();
  sheet.getSheetId = () => 987654321;
  const spreadsheet = {
    getUrl: () => "https://docs.google.com/spreadsheets/d/example/edit",
    getSheetByName: (name) => name === "Amazon Products USA" ? sheet : null,
    insertSheet: () => sheet
  };

  const result = context.writeProducts_(spreadsheet, [
    product("B000000001", "USA product", 20, 100, 10, "amazon.com")
  ]);

  assert.equal(
    result.sheetUrl,
    "https://docs.google.com/spreadsheets/d/example/edit#gid=987654321"
  );
});

test("server product URLthi marketplace derive kare ane mismatch reject kare chhe", () => {
  const context = loadAppsScript();
  const usaProduct = product(
    "B000000001",
    "USA product",
    20,
    100,
    10,
    "amazon.com"
  );
  usaProduct.marketplace = "amazon.in";
  assert.throws(
    () => context.validatePayload_({
      marketplace: "amazon.in",
      categoryUrl: "https://www.amazon.in/s?k=test",
      products: [usaProduct]
    }),
    /URL selected marketplace/
  );
  assert.equal(
    context.marketplaceForProduct_(usaProduct),
    "amazon.com"
  );
});

test("target spreadsheet exact provided IDthi open thay chhe", () => {
  const context = loadAppsScript();
  let openedId = "";
  const spreadsheet = {};
  context.SpreadsheetApp = {
    openById: (id) => {
      openedId = id;
      return spreadsheet;
    }
  };

  assert.equal(context.getTargetSpreadsheet_(), spreadsheet);
  assert.equal(
    openedId,
    "12JfxDejTWTMsOUlnVANQsnjsIg27UE82_9KuFbeZq-k"
  );
});
