import test from "node:test"
import assert from "node:assert/strict"
import { applyDecisionHeaders, buildDenyBody } from "../../gateway/src/utils/headers.js"

test("deny body and headers expose explainability contract", () => {
  const decision = {
    traceId: "trace-1",
    tenantId: "tenant-pro",
    route: "/api/export",
    requestCost: 25,
    decision: "DENY",
    reason: "RATE_LIMIT_EXCEEDED",
    creditsRemaining: 0,
    retryAfterMs: 1200,
    degraded: false,
    degradedMode: null
  }

  const headers = new Map()
  const reply = {
    header(name, value) {
      headers.set(name, value)
    }
  }

  applyDecisionHeaders(reply, decision)
  const body = buildDenyBody(decision)

  assert.equal(headers.get("X-Sentinel-Decision"), "DENY")
  assert.equal(headers.get("X-Sentinel-Reason"), "RATE_LIMIT_EXCEEDED")
  assert.equal(body.traceId, "trace-1")
  assert.equal(body.retryAfterMs, 1200)
})

