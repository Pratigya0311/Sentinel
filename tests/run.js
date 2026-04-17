import assert from "node:assert/strict"
import { calculateRequestCost } from "../gateway/src/services/costEngine.js"
import { evaluateTenantFairness } from "../gateway/src/services/tenantEngine.js"
import { FallbackLimiter } from "../gateway/src/resilience/fallbackLimiter.js"
import { CircuitBreaker } from "../gateway/src/resilience/circuitBreaker.js"
import { applyDecisionHeaders, buildDenyBody } from "../gateway/src/utils/headers.js"
import { MetricsStore } from "../aggregator/src/ingest.js"
import { AbuseEngine } from "../gateway/src/services/abuseEngine.js"

function check(name, fn) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

check("cost engine increases cost under high latency", () => {
  const result = calculateRequestCost("/api/export", { "/api/export": { baseCost: 25 } }, 920)
  assert.equal(result.dynamicMultiplier, 1.7)
  assert.equal(result.effectiveCost, 43)
})

check("tenant fairness blocks max-share overrun", () => {
  const fairness = evaluateTenantFairness({
    tenant: { creditBudget: 100, maxShare: 0.25 },
    requestCost: 20,
    currentSpend: 40,
    totalSpend: 60
  })

  assert.equal(fairness.allowed, false)
  assert.equal(fairness.reason, "TENANT_MAX_SHARE_EXCEEDED")
})

check("fallback limiter blocks over-budget local traffic", () => {
  const limiter = new FallbackLimiter({ rate: 5, burst: 10 })
  const first = limiter.consume("tenant-pro:/api/search", 6)
  const second = limiter.consume("tenant-pro:/api/search", 6)
  assert.equal(first.allowed, true)
  assert.equal(second.allowed, false)
  assert.ok(second.retryAfterMs > 0)
})

check("circuit breaker opens after threshold", () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 })
  breaker.failure()
  breaker.failure()
  assert.equal(breaker.state, "open")
  assert.equal(breaker.allowRequest(), false)
})

check("explainability headers and deny body match contract", () => {
  const headers = new Map()
  const reply = {
    header(name, value) {
      headers.set(name, value)
    }
  }
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

  applyDecisionHeaders(reply, decision)
  const body = buildDenyBody(decision)
  assert.equal(headers.get("X-Sentinel-Decision"), "DENY")
  assert.equal(body.retryAfterMs, 1200)
})

check("aggregator snapshot rolls up requests and reasons", () => {
  const store = new MetricsStore()
  store.ingest({
    bucket: Date.now(),
    instanceId: "gateway-1",
    totalRequests: 3,
    allowedCount: 1,
    blockedCount: 2,
    creditsConsumed: 36,
    reasons: {
      REDIS_UNAVAILABLE_FAIL_OPEN: 1,
      REDIS_UNAVAILABLE_FAIL_CLOSED: 1,
      TENANT_MAX_SHARE_EXCEEDED: 1
    },
    routes: {
      "/api/export": { requests: 1, credits: 25, latencyP95: 800 },
      "/api/health": { requests: 2, credits: 11, latencyP95: 30 }
    },
    tenants: {
      "tenant-free": { requests: 2, credits: 26, denied: 1 },
      "tenant-pro": { requests: 1, credits: 10, denied: 1 }
    },
    instances: {
      "gateway-1": { totalRequests: 3, allowedCount: 1, blockedCount: 2 }
    },
    redis: { status: "degraded", failures: 3 },
    controller: { multiplier: 0.82, health: "stressed", reason: "LATENCY_ELEVATED" },
    degraded: { active: true, modes: { FAIL_OPEN: 1, FAIL_CLOSED: 1 } }
  })

  const snapshot = store.snapshot()
  assert.equal(snapshot.totals.totalRequests, 3)
  assert.equal(snapshot.topEndpoints[0].key, "/api/export")
  assert.equal(snapshot.topReasons.length, 3)
  assert.equal(snapshot.totals.redis.status, "degraded")
  assert.equal(snapshot.instances[0].instanceId, "gateway-1")
})

check("abuse engine escalates on denied streaks and route fan-out", () => {
  const engine = new AbuseEngine()
  engine.observeResult({ tenantId: "tenant-pro", denied: true })
  engine.observeResult({ tenantId: "tenant-pro", denied: true })
  engine.evaluate({ tenantId: "tenant-pro", route: "/api/health", threshold: 100 })
  engine.evaluate({ tenantId: "tenant-pro", route: "/api/user", threshold: 100 })
  const result = engine.evaluate({ tenantId: "tenant-pro", route: "/api/search", threshold: 0.8 })

  assert.ok(result.routeFanout >= 3)
  assert.ok(result.score >= 0.8)
  assert.equal(result.blocked, true)
})
