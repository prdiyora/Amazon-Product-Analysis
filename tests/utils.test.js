const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canonicalProductUrl,
  compareProducts,
  getMarketplaceFromUrl,
  parseCompactCount,
  parseInteger
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
