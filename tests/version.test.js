const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../manifest.json");
const packageInfo = require("../package.json");

test("website package ane extension manifest same version use kare chhe", () => {
  assert.equal(packageInfo.version, manifest.version);
});

test("extension manifest na badha logo icon assets available chhe", () => {
  const iconPaths = new Set([
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ]);

  iconPaths.forEach((iconPath) => {
    assert.equal(existsSync(join(__dirname, "..", iconPath)), true, iconPath);
  });
  assert.equal(
    existsSync(join(__dirname, "..", "assets", "amazon-product-analysis-logo.svg")),
    true
  );
});

test("website full features setup usage ane Sheet data sections aape chhe", () => {
  const app = readFileSync(join(__dirname, "..", "web", "App.jsx"), "utf8");
  [
    "Complete feature set",
    "One-time setup",
    "Every analysis",
    "What reaches Google Sheets"
  ].forEach((heading) => assert.match(app, new RegExp(heading)));
});
