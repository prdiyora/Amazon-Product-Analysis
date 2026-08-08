const test = require("node:test");
const assert = require("node:assert/strict");
const errors = require("../src/shared/errors.js");

test("structured error useful diagnostics preserve kare chhe", () => {
  const error = errors.create("Apps Script public nathi.", {
    code: "APPS_SCRIPT_NOT_PUBLIC",
    stage: "upload",
    httpStatus: 404,
    responseHost: "accounts.google.com",
    hint: 'Deployment access "Anyone" set karo.'
  });
  const details = errors.serialize(error);

  assert.equal(details.code, "APPS_SCRIPT_NOT_PUBLIC");
  assert.equal(details.stage, "upload");
  assert.equal(details.httpStatus, 404);
  assert.equal(details.responseHost, "accounts.google.com");
  assert.match(details.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("serialized details mathi same structured error recreate thay chhe", () => {
  const recreated = errors.fromDetails({
    code: "AMAZON_HTTP_ERROR",
    stage: "amazon_fetch",
    message: "Amazon HTTP 503",
    httpStatus: 503,
    timestamp: "2026-08-08T12:00:00.000Z"
  });

  assert.equal(recreated.code, "AMAZON_HTTP_ERROR");
  assert.equal(recreated.stage, "amazon_fetch");
  assert.equal(recreated.httpStatus, 503);
  assert.equal(recreated.timestamp, "2026-08-08T12:00:00.000Z");
});

test("copied diagnostics ASIN, Amazon URL ane token redact kare chhe", () => {
  const redacted = errors.redactDiagnostics(
    "Product B012345678 failed at https://www.amazon.in/dp/B012345678?token=secret"
  );

  assert.equal(
    redacted,
    "Product [REDACTED_ASIN] failed at [REDACTED_AMAZON_URL]"
  );
});
