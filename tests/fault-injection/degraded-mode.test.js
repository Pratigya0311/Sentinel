import test from "node:test"
import assert from "node:assert/strict"
import { FallbackLimiter } from "../../gateway/src/resilience/fallbackLimiter.js"
import { CircuitBreaker } from "../../gateway/src/resilience/circuitBreaker.js"

test("fallback limiter blocks requests above conservative local budget", () => {
  const limiter = new FallbackLimiter({ rate: 5, burst: 10 })

  const first = limiter.consume("tenant-pro:/api/search", 6)
  const second = limiter.consume("tenant-pro:/api/search", 6)

  assert.equal(first.allowed, true)
  assert.equal(second.allowed, false)
  assert.ok(second.retryAfterMs > 0)
})

test("circuit breaker opens after repeated failures", () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 })

  breaker.failure()
  breaker.failure()

  assert.equal(breaker.state, "open")
  assert.equal(breaker.allowRequest(), false)
})

