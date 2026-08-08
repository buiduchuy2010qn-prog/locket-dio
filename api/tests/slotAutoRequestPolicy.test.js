const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_AUTO_REQUEST_ATTEMPTS,
  getAutoRequestRetryDelayMs,
  isRetryableAutoRequestFailure,
  normalizeAutoRequestFailure,
} = require("../src/modules/slotMonitor/autoRequestPolicy");

test("Celeb auto-request only retries transient failures", () => {
  assert.equal(MAX_AUTO_REQUEST_ATTEMPTS, 3);
  assert.equal(isRetryableAutoRequestFailure({ status: 502, code: "UPSTREAM_ERROR" }), true);
  assert.equal(isRetryableAutoRequestFailure({ status: 429, code: "RATE_LIMITED" }), true);
  assert.equal(isRetryableAutoRequestFailure({ status: null, code: "ECONNRESET" }), true);
  assert.equal(isRetryableAutoRequestFailure({ status: 401, code: "UPSTREAM_AUTH_FAILED" }), false);
  assert.equal(isRetryableAutoRequestFailure({ status: 403, code: "UPSTREAM_AUTH_FAILED" }), false);
  assert.equal(isRetryableAutoRequestFailure({ status: 409, code: "REQUEST_CONFLICT" }), false);
  assert.equal(isRetryableAutoRequestFailure({ status: 400, code: "UPSTREAM_REJECTED" }), false);
});

test("App Check device token configuration errors are not retried", () => {
  const failure = normalizeAutoRequestFailure({
    code: "APPCHECK_DEVICE_TOKEN_MISSING",
    message: "Device token not found",
  });

  assert.equal(failure.source, "appcheck");
  assert.equal(failure.retryable, false);
  assert.equal(failure.message, "Device token not found");
});

test("App Check 5xx and rate limits remain retryable with useful details", () => {
  const upstream = normalizeAutoRequestFailure({
    code: "APPCHECK_UPSTREAM_ERROR",
    status: 503,
    message: "temporarily unavailable",
  });
  const rateLimited = normalizeAutoRequestFailure({
    code: "APPCHECK_RATE_LIMITED",
    status: 429,
    message: "too many requests",
  });

  assert.equal(upstream.retryable, true);
  assert.equal(upstream.status, 503);
  assert.equal(rateLimited.retryable, true);
  assert.equal(rateLimited.status, 429);
});

test("retry delay backs off and gives 429 extra space", () => {
  const first = getAutoRequestRetryDelayMs(1, 502);
  const second = getAutoRequestRetryDelayMs(2, 502);

  assert.ok(first >= 300 && first <= 450);
  assert.ok(second >= 900 && second <= 1050);
  assert.equal(getAutoRequestRetryDelayMs(1, 429), 1500);
  assert.equal(getAutoRequestRetryDelayMs(2, 429), 3000);
});
