const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ANALYSIS_NAME_MAX_LENGTH,
  buildAnalysisTabName,
  buildAmazonSearchUrl,
  buildUploadPayload,
  canonicalProductUrl,
  compareProducts,
  getAmazonSearchQuery,
  getMarketplaceFromUrl,
  isAppsScriptEndpoint,
  isMatchingAmazonSearch,
  parseCompactCount,
  parseInteger,
  validateAnalysisName,
  validateOptionalAnalysisName
} = require("../src/shared/utils.js");

test("India ane USA product URLs marketplace pramane canonical thay chhe", () => {
  assert.equal(
    canonicalProductUrl("/example/dp/B000000001", "B000000001", "https://www.amazon.in/s?k=x"),
    "https://www.amazon.in/dp/B000000001"
  );
  assert.equal(
    canonicalProductUrl("/example/dp/B000000001", "B000000001", "https://www.amazon.com/s?k=x"),
    "https://www.amazon.com/dp/B000000001"
  );
  assert.equal(getMarketplaceFromUrl("https://www.amazon.com/dp/B000000001"), "amazon.com");
});

test("compact bought formats normalize thay chhe", () => {
  assert.equal(parseCompactCount("100+ bought in past month"), 100);
  assert.equal(parseCompactCount("1K+ bought in past month"), 1000);
  assert.equal(parseCompactCount("1.5K+ bought in past month"), 1500);
  assert.equal(parseCompactCount("1L+ bought in past month"), 100000);
  assert.equal(parseCompactCount(""), null);
});

test("review text integerma normalize thay chhe", () => {
  assert.equal(parseInteger("12,345 ratings"), 12345);
  assert.equal(parseInteger(""), null);
});

test("products bought descending ane tie par reviews ascending sort thay chhe", () => {
  const products = [
    { asin: "B", boughtCount: 1000, reviewCount: 900 },
    { asin: "A", boughtCount: 2000, reviewCount: 5000 },
    { asin: "C", boughtCount: 1000, reviewCount: 20 },
    { asin: "D", boughtCount: null, reviewCount: 1 }
  ];

  products.sort(compareProducts);
  assert.deepEqual(products.map((product) => product.asin), ["A", "C", "B", "D"]);
});

test("brand ane product keyword mate marketplace search URL bane chhe", () => {
  assert.equal(
    buildAmazonSearchUrl("amazon.in", "  Sellbotic  "),
    "https://www.amazon.in/s?k=Sellbotic"
  );
  assert.equal(
    buildAmazonSearchUrl("amazon.com", "oil sprayer"),
    "https://www.amazon.com/s?k=oil+sprayer"
  );
  assert.equal(buildAmazonSearchUrl("amazon.in", "   "), "");
});

test("Amazon search URL query read ane match thay chhe", () => {
  const url =
    "https://www.amazon.in/s?k=sellbotic&crid=2JTR50P5YDIN6&ref=nb_sb_noss_2";
  assert.equal(getAmazonSearchQuery(url), "sellbotic");
  assert.equal(isMatchingAmazonSearch(url, "amazon.in", "Sellbotic"), true);
  assert.equal(isMatchingAmazonSearch(url, "amazon.com", "Sellbotic"), false);
  assert.equal(isMatchingAmazonSearch("https://www.amazon.in/dp/B000000001", "amazon.in", "Sellbotic"), false);
});

test("Apps Script exec endpoint validate thay chhe", () => {
  assert.equal(
    isAppsScriptEndpoint("https://script.google.com/macros/s/abc123/exec"),
    true
  );
  assert.equal(
    isAppsScriptEndpoint("https://script.google.com/macros/s/abc123/dev"),
    false
  );
  assert.equal(isAppsScriptEndpoint("https://example.com/macros/s/abc123/exec"), false);
});

test("analysis name normalize thai marketplace suffix sathe tab name bane chhe", () => {
  assert.deepEqual(validateAnalysisName("  Umbrella   Analysis  "), {
    valid: true,
    name: "Umbrella Analysis"
  });
  assert.equal(
    buildAnalysisTabName("Umbrella Analysis", "amazon.in"),
    "Umbrella Analysis - IN"
  );
  assert.equal(
    buildAnalysisTabName("Umbrella Analysis", "amazon.com"),
    "Umbrella Analysis - USA"
  );
});

test("analysis name invalid input reject kare chhe", () => {
  assert.equal(validateAnalysisName("  ").code, "ANALYSIS_NAME_MISSING");
  assert.equal(
    validateAnalysisName("Umbrella / Monsoon").code,
    "ANALYSIS_NAME_INVALID_CHARACTERS"
  );
  assert.equal(
    validateAnalysisName("x".repeat(ANALYSIS_NAME_MAX_LENGTH + 1)).code,
    "ANALYSIS_NAME_TOO_LONG"
  );
  assert.equal(
    buildAnalysisTabName("Invalid [Name]", "amazon.in"),
    ""
  );
});

test("blank optional analysis name default marketplace tabs use kare chhe", () => {
  assert.deepEqual(validateOptionalAnalysisName("   "), {
    valid: true,
    name: "",
    isDefault: true
  });
  assert.equal(buildAnalysisTabName("", "amazon.in"), "Amazon Products IN");
  assert.equal(buildAnalysisTabName("", "amazon.com"), "Amazon Products USA");
  assert.equal(
    validateOptionalAnalysisName("Invalid / Name").code,
    "ANALYSIS_NAME_INVALID_CHARACTERS"
  );
});

test("progressive ane retry payload run nu locked analysis name preserve kare chhe", () => {
  const state = {
    runId: "run-1",
    marketplace: "amazon.in",
    analysisName: "Umbrella Analysis",
    categoryUrl: "https://www.amazon.in/s?k=umbrella",
    categoryName: "Product search: umbrella",
    categoryPath: "Product search > umbrella"
  };
  const products = [{
    asin: "B000000001",
    title: "Umbrella",
    productUrl: "https://www.amazon.in/dp/B000000001",
    status: "ok"
  }];
  const timestamp = "2026-08-09T00:00:00.000Z";

  const progressivePayload = buildUploadPayload(state, products, timestamp);
  const retryPayload = buildUploadPayload(state, products, timestamp);

  assert.equal(progressivePayload.analysisName, "Umbrella Analysis");
  assert.equal(retryPayload.analysisName, "Umbrella Analysis");
  assert.deepEqual(retryPayload, progressivePayload);
});
