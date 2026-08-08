(function initErrors(root) {
  const DEFAULT_CODE = "UNEXPECTED_ERROR";
  const DEFAULT_STAGE = "unknown";

  function cleanText(value, fallback = "") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function create(message, options = {}) {
    const error = new Error(cleanText(message, "Unknown extension error"));
    error.code = cleanText(options.code, DEFAULT_CODE);
    error.stage = cleanText(options.stage, DEFAULT_STAGE);

    if (Number.isFinite(Number(options.httpStatus))) {
      error.httpStatus = Number(options.httpStatus);
    }
    if (Number.isFinite(Number(options.attempt))) {
      error.attempt = Number(options.attempt);
    }
    if (options.responseHost) {
      error.responseHost = cleanText(options.responseHost);
    }
    if (options.responseType) {
      error.responseType = cleanText(options.responseType);
    }
    if (options.hint) {
      error.hint = cleanText(options.hint);
    }
    return error;
  }

  function serialize(error, fallback = {}) {
    const source =
      error && typeof error === "object"
        ? error
        : { message: cleanText(error, fallback.message) };
    const details = {
      code: cleanText(source.code, cleanText(fallback.code, DEFAULT_CODE)),
      stage: cleanText(source.stage, cleanText(fallback.stage, DEFAULT_STAGE)),
      message: cleanText(
        source.message,
        cleanText(fallback.message, "Unknown extension error")
      ),
      timestamp: cleanText(
        source.timestamp,
        cleanText(fallback.timestamp, new Date().toISOString())
      ),
      name: cleanText(source.name, "Error")
    };

    const httpStatus = Number(source.httpStatus ?? fallback.httpStatus);
    if (Number.isFinite(httpStatus)) {
      details.httpStatus = httpStatus;
    }

    const attempt = Number(source.attempt ?? fallback.attempt);
    if (Number.isFinite(attempt)) {
      details.attempt = attempt;
    }

    const responseHost = cleanText(
      source.responseHost,
      cleanText(fallback.responseHost)
    );
    if (responseHost) {
      details.responseHost = responseHost;
    }

    const responseType = cleanText(
      source.responseType,
      cleanText(fallback.responseType)
    );
    if (responseType) {
      details.responseType = responseType;
    }

    const hint = cleanText(source.hint, cleanText(fallback.hint));
    if (hint) {
      details.hint = hint;
    }

    const stack = cleanText(source.stack);
    if (stack) {
      details.stack = stack.slice(0, 1600);
    }
    return details;
  }

  function fromDetails(details, fallback = {}) {
    const normalized = serialize(details, fallback);
    const error = create(normalized.message, normalized);
    error.timestamp = normalized.timestamp;
    if (normalized.stack) {
      error.stack = normalized.stack;
    }
    return error;
  }

  function redactDiagnostics(value) {
    return String(value ?? "")
      .replace(/\bB[A-Z0-9]{9}\b/gi, "[REDACTED_ASIN]")
      .replace(
        /https?:\/\/(?:www\.)?amazon\.(?:in|com)\/[^\s)]+/gi,
        "[REDACTED_AMAZON_URL]"
      )
      .replace(
        /([?&](?:token|key|auth)=)[^&\s]+/gi,
        "$1[REDACTED]"
      );
  }

  const errors = Object.freeze({
    create,
    serialize,
    fromDetails,
    redactDiagnostics
  });
  root.AZScraper = root.AZScraper || {};
  root.AZScraper.errors = errors;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = errors;
  }
})(globalThis);
