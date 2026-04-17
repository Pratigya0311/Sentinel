import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import Redis from "ioredis"
import { LimiterClient } from "../../gateway/src/redis/limiterClient.js"

const route = "/edge/fixed"
const routeSliding = "/edge/sliding"
const routeBucket = "/edge/bucket"

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe"
  })
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n"))
  }
  return result.stdout.trim()
}

async function waitForRedis(redis, timeoutMs = 60000) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeoutMs) {
    try {
      await redis.ping()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  throw lastError ?? new Error("Redis did not become ready")
}

async function main() {
  run("docker-compose", ["rm", "-fsv", "redis-primary", "redis-replica-1", "redis-replica-2", "redis-sentinel-1", "redis-sentinel-2", "redis-sentinel-3"])
  run("docker-compose", ["up", "-d", "redis-primary", "redis-replica-1", "redis-replica-2", "redis-sentinel-1", "redis-sentinel-2", "redis-sentinel-3"])
  const redis = new Redis({
    host: "127.0.0.1",
    port: 6379,
    connectTimeout: 2000,
    retryStrategy: (times) => Math.min(times * 200, 1000)
  })
  const limiter = new LimiterClient(redis)
  await waitForRedis(redis)
  await limiter.loadScripts()
  await redis.flushdb()

  const tenant = {
    tenantId: "edge-tenant",
    creditBudget: 1000,
    burst: 0,
    maxShare: 1
  }

  const fixedPolicy = {
    algorithm: "fixed-window",
    capacity: 10,
    globalCapacity: 20,
    windowMs: 2000
  }

  const fixedA = await limiter.evaluate({ policy: fixedPolicy, tenant, route, requestCost: 4 })
  const fixedB = await limiter.evaluate({ policy: fixedPolicy, tenant, route, requestCost: 4 })
  const fixedC = await limiter.evaluate({ policy: fixedPolicy, tenant, route, requestCost: 4 })
  assert.equal(fixedA.allowed, true)
  assert.equal(fixedB.allowed, true)
  assert.equal(fixedC.allowed, false)
  assert.equal(fixedC.reason, "RATE_LIMIT_EXCEEDED")

  const slidingPolicy = {
    algorithm: "sliding-window",
    capacity: 15,
    globalCapacity: 30,
    windowMs: 1200
  }

  const slidingResults = await Promise.all(
    [5, 5, 5, 5].map((cost) => limiter.evaluate({ policy: slidingPolicy, tenant, route: routeSliding, requestCost: cost }))
  )
  const deniedSliding = slidingResults.filter((item) => !item.allowed)
  assert.equal(deniedSliding.length, 1)
  assert.equal(deniedSliding[0].reason, "RATE_LIMIT_EXCEEDED")

  const bucketPolicy = {
    algorithm: "token-bucket",
    capacity: 10,
    globalCapacity: 25,
    refillRate: 2,
    windowMs: 5000
  }

  const bucketFirst = await limiter.evaluate({ policy: bucketPolicy, tenant, route: routeBucket, requestCost: 7 })
  const bucketSecond = await limiter.evaluate({ policy: bucketPolicy, tenant, route: routeBucket, requestCost: 4 })
  assert.equal(bucketFirst.allowed, true)
  assert.equal(bucketSecond.allowed, false)
  assert.equal(bucketSecond.reason, "RATE_LIMIT_EXCEEDED")
  assert.ok(bucketSecond.retryAfterMs > 0)

  const budgetTenant = {
    tenantId: "budget-tenant",
    creditBudget: 8,
    burst: 0,
    maxShare: 1
  }
  const budgetDenied = await limiter.evaluate({
    policy: fixedPolicy,
    tenant: budgetTenant,
    route: "/edge/budget",
    requestCost: 10
  })
  assert.equal(budgetDenied.allowed, false)
  assert.equal(budgetDenied.reason, "TENANT_BUDGET_EXHAUSTED")

  await redis.quit()
  console.log("Redis edge-case verification passed.")
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
