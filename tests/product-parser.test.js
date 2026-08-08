const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");

require("../src/shared/utils.js");
const { parseProduct } = require("../src/parsers/product-parser.js");

test("product parser price, reviews ane bought count normalize kare chhe", () => {
  const html = readFileSync(join(__dirname, "fixtures", "product.html"), "utf8");
  const { document } = parseHTML(html);
  const product = parseProduct(
    document,
    "https://www.amazon.in/example/dp/B000000001"
  );

  assert.equal(product.asin, "B000000001");
  assert.equal(product.title, "Example Phone One");
  assert.equal(product.brand, "Example Brand");
  assert.equal(product.priceValue, 12499);
  assert.equal(product.currency, "INR");
  assert.equal(product.rating, 4.3);
  assert.equal(product.reviewCount, 1234);
  assert.equal(product.boughtCount, 2000);
  assert.equal(product.status, "ok");
});

test("CAPTCHA page blocked status return kare chhe", () => {
  const { document } = parseHTML(`
    <html><head><title>Robot Check</title></head>
    <body><form action="/errors/validateCaptcha"><input id="captchacharacters"></form></body>
    </html>
  `);
  const product = parseProduct(
    document,
    "https://www.amazon.in/dp/B000000009",
    "B000000009"
  );

  assert.equal(product.status, "blocked");
  assert.match(product.error, /CAPTCHA/);
});

test("Amazon.com dollar price USD tarike parse thay chhe", () => {
  const { document } = parseHTML(`
    <html><head><title>USA Product</title></head><body>
      <input id="ASIN" value="B000000010">
      <span id="productTitle">USA Product</span>
      <div id="corePrice_feature_div">
        <span class="a-price"><span class="a-offscreen">$29.99</span></span>
      </div>
    </body></html>
  `);
  const product = parseProduct(
    document,
    "https://www.amazon.com/dp/B000000010"
  );

  assert.equal(product.productUrl, "https://www.amazon.com/dp/B000000010");
  assert.equal(product.priceValue, 29.99);
  assert.equal(product.currency, "USD");
});

test("product overview table mathi brand parse thay chhe", () => {
  const { document } = parseHTML(`
    <html><body>
      <input id="ASIN" value="B000000011">
      <span id="productTitle">Kitchen Product</span>
      <div id="productOverview_feature_div">
        <table><tr><td>Brand</td><td>Kitchen Pro</td></tr></table>
      </div>
    </body></html>
  `);
  const product = parseProduct(
    document,
    "https://www.amazon.in/dp/B000000011"
  );

  assert.equal(product.brand, "Kitchen Pro");
});
