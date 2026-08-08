const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseHTML } = require("linkedom");

require("../src/shared/utils.js");
const { parseListing } = require("../src/parsers/listing-parser.js");

test("listing parser sponsored products exclude kari next page resolve kare chhe", () => {
  const html = readFileSync(join(__dirname, "fixtures", "listing.html"), "utf8");
  const { document } = parseHTML(html);
  const result = parseListing(document, "https://www.amazon.in/s?k=mobiles");

  assert.equal(result.categoryName, "Mobiles");
  assert.deepEqual(
    result.products.map((product) => product.asin),
    ["B000000001", "B000000003"]
  );
  assert.equal(result.products[0].url, "https://www.amazon.in/dp/B000000001");
  assert.equal(result.nextUrl, "https://www.amazon.in/s?k=mobiles&page=2");
});

test("USA listing relative product ane next URLs amazon.com par rakhe chhe", () => {
  const { document } = parseHTML(`
    <html><body>
      <h1>Kitchen</h1>
      <div data-component-type="s-search-result" data-asin="B000000001">
        <h2><a href="/Example/dp/B000000001">Example</a></h2>
      </div>
      <a class="s-pagination-next" href="/s?k=kitchen&page=2">Next</a>
    </body></html>
  `);
  const result = parseListing(document, "https://www.amazon.com/s?k=kitchen");

  assert.equal(result.products[0].url, "https://www.amazon.com/dp/B000000001");
  assert.equal(result.nextUrl, "https://www.amazon.com/s?k=kitchen&page=2");
});

test("full category breadcrumb Any Department vagar leaf sathe parse thay chhe", () => {
  const { document } = parseHTML(`
    <html><body>
      <div id="wayfinding-breadcrumbs_feature_div"><ul>
        <li>Any Department</li>
        <li>Home &amp; Kitchen</li>
        <li>Kitchen &amp; Dining</li>
        <li>Kitchen Tools</li>
        <li>Oil Preparation &amp; Dispensers</li>
      </ul></div>
      <h1>Oil Sprayers</h1>
    </body></html>
  `);
  const result = parseListing(
    document,
    "https://www.amazon.in/s?node=example"
  );

  assert.equal(
    result.categoryPath,
    "Home & Kitchen›Kitchen & Dining›Kitchen Tools›Oil Preparation & Dispensers›Oil Sprayers"
  );
});
