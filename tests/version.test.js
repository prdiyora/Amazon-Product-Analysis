const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../manifest.json");
const packageInfo = require("../package.json");

test("website package ane extension manifest same version use kare chhe", () => {
  assert.equal(packageInfo.version, manifest.version);
});
