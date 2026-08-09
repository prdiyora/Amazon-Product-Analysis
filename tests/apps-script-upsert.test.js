const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

class FakeSheet {
  constructor(name = "") {
    this.rows = [];
    this.backgrounds = [];
    this.name = name;
    this.id = FakeSheet.nextId++;
  }

  getLastRow() {
    return this.rows.length;
  }

  getLastColumn() {
    return this.rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  }

  setFrozenRows() {}

  getName() {
    return this.name;
  }

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
      },
      setBackgrounds: (values) => {
        values.forEach((row, rowOffset) => {
          const targetRow = startRow - 1 + rowOffset;
          this.backgrounds[targetRow] ||= [];
          row.forEach((value, columnOffset) => {
            this.backgrounds[targetRow][startColumn - 1 + columnOffset] = value;
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

function writeProducts(context, spreadsheet, products, analysisName = "Test Analysis") {
  return context.writeProducts_(spreadsheet, products, analysisName);
}

test("Apps Script same ASIN update kare ane only new ASIN append kare chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const first = writeProducts(context, spreadsheet, [
    product("B000000001", "Old title", 100),
    product("B000000002", "Second product", 200)
  ]);
  const second = writeProducts(context, spreadsheet, [
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
  const sheet = sheets.get("Test Analysis - IN");
  assert.equal(sheet.rows.length, 4);
  assert.equal(sheet.rows[1][4], "B000000001");
  assert.equal(sheet.rows[1][5], "Latest title");
  assert.equal(sheet.rows[1][9], 150);
  assert.equal(sheets.get("Amazon Products IN").rows.length, 1);
});

test("same payloadma duplicate ASIN last value sathe ek j row banave chhe", () => {
  const context = loadAppsScript();
  const sheet = new FakeSheet();
  const spreadsheet = {
    getSheetByName: () => sheet,
    insertSheet: () => sheet
  };

  const result = writeProducts(context, spreadsheet, [
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

  writeProducts(context, spreadsheet, [
    product("B000000001", "Low bought", 100, 100, 2),
    product("B000000002", "High reviews", 200, 1000, 500),
    product("B000000003", "Low reviews", 300, 1000, 20)
  ]);

  assert.deepEqual(
    sheet.rows.slice(1).map((row) => row[4]),
    ["B000000003", "B000000002", "B000000001"]
  );
});

test("same run ni rows same light color ane next run alag color use kare chhe", () => {
  const context = loadAppsScript();
  const sheet = new FakeSheet();
  const spreadsheet = {
    getSheetByName: () => sheet,
    insertSheet: () => sheet
  };
  const first = product("B000000001", "First run A", 100);
  const second = product("B000000002", "First run B", 200);
  const third = product("B000000003", "Second run", 300);
  first.runTimestamp = "2026-08-09T10:00:00.000Z";
  second.runTimestamp = first.runTimestamp;
  third.runTimestamp = "2026-08-09T11:00:00.000Z";

  writeProducts(context, spreadsheet, [first, second]);
  writeProducts(context, spreadsheet, [third]);

  const rowByAsin = new Map(
    sheet.rows.slice(1).map((row, index) => [row[4], index + 1])
  );
  const firstColor = sheet.backgrounds[rowByAsin.get(first.asin)][0];
  const secondColor = sheet.backgrounds[rowByAsin.get(second.asin)][0];
  const thirdColor = sheet.backgrounds[rowByAsin.get(third.asin)][0];
  assert.equal(firstColor, secondColor);
  assert.notEqual(firstColor, thirdColor);
  assert.equal(sheet.backgrounds[rowByAsin.get(first.asin)].length, 18);
});

test("same ASIN India ane USA marketplace mate separate rows rahe chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const indiaResult = writeProducts(context, spreadsheet, [
    product("B000000001", "India product", 100, 100, 10, "amazon.in")
  ], "Umbrella Analysis");

  assert.deepEqual(
    Array.from(sheets.keys()).sort(),
    ["Amazon Products IN", "Umbrella Analysis - IN"]
  );
  assert.equal(indiaResult.rowsAdded, 1);
  assert.equal(
    sheets.get("Umbrella Analysis - IN").rows[1][17],
    "amazon.in"
  );

  const usaResult = writeProducts(context, spreadsheet, [
    product("B000000001", "USA product", 25, 200, 20, "amazon.com")
  ], "Umbrella Analysis");

  assert.equal(usaResult.rowsAdded, 1);
  assert.deepEqual(
    Array.from(sheets.keys()).sort(),
    [
      "Amazon Products IN",
      "Amazon Products USA",
      "Umbrella Analysis - IN",
      "Umbrella Analysis - USA"
    ]
  );
  assert.equal(
    sheets.get("Umbrella Analysis - USA").rows[1][17],
    "amazon.com"
  );
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
  legacySheet.name = "Legacy Analysis - IN";
  const sheets = new Map([["Legacy Analysis - IN", legacySheet]]);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const result = writeProducts(context, spreadsheet, [
    product("B000000001", "Latest India title", 150)
  ], "Legacy Analysis");

  assert.equal(result.rowsAdded, 0);
  assert.equal(result.rowsUpdated, 1);
  assert.equal(sheets.get("Legacy Analysis - IN").rows[0][3], "Category Path");
  assert.equal(sheets.get("Legacy Analysis - IN").rows[0][6], "Brand");
  assert.equal(
    sheets.get("Legacy Analysis - IN").rows[1][5],
    "Latest India title"
  );
  assert.equal(sheets.get("Legacy Analysis - IN").rows[1][17], "amazon.in");
});

test("new configuration default IN banave pan USA ke unrelated tab touch nathi kartu", () => {
  const context = loadAppsScript();
  const notes = new FakeSheet("Notes");
  notes.rows = [["Keep this data"]];
  const sheets = new Map([["Notes", notes]]);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
    getId: () => "configured-sheet-id",
    getName: () => "Research Sheet"
  };
  context.SpreadsheetApp = {
    getActiveSpreadsheet: () => spreadsheet
  };

  const result = context.configureTargetSpreadsheet();

  assert.equal(result, "Target Sheet connected: Research Sheet");
  assert.deepEqual(
    Array.from(sheets.keys()).sort(),
    ["Amazon Products IN", "Notes"]
  );
  assert.equal(sheets.get("Amazon Products IN").rows[0][0], "Run Timestamp");
  assert.equal(sheets.has("Amazon Products USA"), false);
  assert.equal(sheets.get("Notes").rows[0][0], "Keep this data");
  assert.equal(
    context.__propertyValues.get("AZ_SCRAPER_SPREADSHEET_ID"),
    "configured-sheet-id"
  );
});

test("first USA run default USA ane selected custom USA tab j banave chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };
  const indiaDefault = context.ensureDefaultMarketplaceSheet_(
    spreadsheet,
    "amazon.in"
  );

  writeProducts(context, spreadsheet, [
    product("B000000001", "USA product", 20, 100, 10, "amazon.com")
  ], "Umbrella Analysis");

  assert.deepEqual(
    Array.from(sheets.keys()).sort(),
    [
      "Amazon Products IN",
      "Amazon Products USA",
      "Umbrella Analysis - USA"
    ]
  );
  assert.equal(sheets.has("Umbrella Analysis - IN"), false);
  assert.equal(indiaDefault.rows.length, 1);
});

test("Apps Script exact marketplace tab URL return kare chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map();
  const spreadsheet = {
    getUrl: () => "https://docs.google.com/spreadsheets/d/example/edit",
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      if (name === "Umbrella Analysis - USA") {
        sheet.getSheetId = () => 987654321;
      }
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const result = writeProducts(context, spreadsheet, [
    product("B000000001", "USA product", 20, 100, 10, "amazon.com")
  ], "Umbrella Analysis");

  assert.equal(
    result.sheetUrl,
    "https://docs.google.com/spreadsheets/d/example/edit#gid=987654321"
  );
});

test("incompatible existing custom tab overwrite karvane badle reject thay chhe", () => {
  const context = loadAppsScript();
  const conflict = new FakeSheet("Umbrella Analysis - IN");
  conflict.rows = [["Personal notes"], ["Do not overwrite"]];
  const sheets = new Map([["Umbrella Analysis - IN", conflict]]);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  assert.throws(
    () => writeProducts(context, spreadsheet, [
      product("B000000001", "India product", 100)
    ], "Umbrella Analysis"),
    /compatible analysis headers nathi/
  );
  assert.deepEqual(conflict.rows, [["Personal notes"], ["Do not overwrite"]]);
});

test("analysis tab ma populated extra columns hoy to sorting pela reject thay chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  writeProducts(context, spreadsheet, [
    product("B000000001", "Original product", 100)
  ], "Umbrella Analysis");
  const analysisSheet = sheets.get("Umbrella Analysis - IN");
  analysisSheet.rows[0][18] = "Private Notes";
  analysisSheet.rows[1][18] = "Keep with original product";
  const before = analysisSheet.rows.map((row) => [...row]);

  assert.throws(
    () => writeProducts(context, spreadsheet, [
      product("B000000002", "New product", 200)
    ], "Umbrella Analysis"),
    /extra data chhe/
  );
  assert.deepEqual(analysisSheet.rows, before);
});

test("partial legacy jeva unrelated headers migrate nathi thata", () => {
  const context = loadAppsScript();
  const conflict = new FakeSheet("Umbrella Analysis - IN");
  conflict.rows = [[
    "Run Timestamp",
    "Owner",
    "Notes",
    "ASIN",
    "Custom title",
    "Private URL"
  ]];
  const sheets = new Map([["Umbrella Analysis - IN", conflict]]);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };
  const before = conflict.rows.map((row) => [...row]);

  assert.throws(
    () => writeProducts(context, spreadsheet, [
      product("B000000001", "India product", 100)
    ], "Umbrella Analysis"),
    /compatible analysis headers nathi/
  );
  assert.deepEqual(conflict.rows, before);
});

test("Apps Script analysis name normalize ane validate kare chhe", () => {
  const context = loadAppsScript();

  assert.equal(
    context.analysisSheetName_("  Umbrella   Analysis  ", "amazon.in"),
    "Umbrella Analysis - IN"
  );
  assert.equal(
    context.analysisSheetName_("Umbrella Analysis", "amazon.com"),
    "Umbrella Analysis - USA"
  );
  assert.equal(context.validateAnalysisName_(""), "");
  assert.throws(
    () => context.validateAnalysisName_("Invalid / Name"),
    /characters allowed nathi/
  );
  assert.throws(
    () => context.validateAnalysisName_("x".repeat(95)),
    /maximum 94/
  );
});

test("blank analysis name selected marketplace default tab ma data lakhe chhe", () => {
  const context = loadAppsScript();
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const result = writeProducts(context, spreadsheet, [
    product("B000000001", "Default India product", 100)
  ], "");

  assert.equal(result.rowsAdded, 1);
  assert.deepEqual(Array.from(sheets.keys()), ["Amazon Products IN"]);
  assert.equal(sheets.get("Amazon Products IN").rows[1][5], "Default India product");
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
      analysisName: "Test Analysis",
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

test("server Subtotal category metadata search keyword thi repair kare chhe", () => {
  const context = loadAppsScript();
  const item = product("B000000001", "Search product", 100);
  item.categoryUrl =
    "https://www.amazon.in/s?k=oil+sprayer&ref=nb_sb_noss";
  item.categoryName = "Subtotal";
  item.categoryPath = "Subtotal";
  const payload = {
    marketplace: "amazon.in",
    analysisName: "",
    categoryUrl: item.categoryUrl,
    products: [item]
  };

  context.validatePayload_(payload);

  assert.equal(item.categoryName, "Search: oil sprayer");
  assert.equal(item.categoryPath, "Amazon Search›oil sprayer");
});

test("configured Script Property IDthi target spreadsheet open thay chhe", () => {
  const context = loadAppsScript();
  let openedId = "";
  const spreadsheet = {};
  context.SpreadsheetApp = {
    openById: (id) => {
      openedId = id;
      return spreadsheet;
    }
  };
  context.__propertyValues.set(
    "AZ_SCRAPER_SPREADSHEET_ID",
    "user-specific-sheet-id"
  );

  assert.equal(context.getTargetSpreadsheet_(), spreadsheet);
  assert.equal(openedId, "user-specific-sheet-id");
});

test("target spreadsheet configure na hoy to clear error ave chhe", () => {
  const context = loadAppsScript();
  context.SpreadsheetApp = {
    openById: () => {
      throw new Error("openById call na thavo joie");
    }
  };

  assert.throws(
    () => context.getTargetSpreadsheet_(),
    /configureTargetSpreadsheet/
  );
});
