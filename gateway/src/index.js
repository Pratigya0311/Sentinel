import Fastify from "fastify"
import { loadConfig } from "./services/configService.js"
import { resolveTenant } from "./middleware/auth.js"
import { resolvePolicy } from "./middleware/policy.js"
import { calculateRequestCost } from "./services/costEngine.js"
import { evaluateTenantFairness } from "./services/tenantEngine.js"
import { AbuseEngine } from "./services/abuseEngine.js"
import { ControllerClient } from "./services/controllerClient.js"
import { MetricsEmitter } from "./services/metrics.js"
import { logDecision } from "./services/auditLogger.js"
import { applyDecisionHeaders, buildDenyBody } from "./utils/headers.js"
import { createTraceId } from "./utils/trace.js"
import { createRedisClient } from "./redis/client.js"
import { LimiterClient } from "./redis/limiterClient.js"
import { CircuitBreaker } from "./resilience/circuitBreaker.js"
import { FallbackLimiter } from "./resilience/fallbackLimiter.js"

const port = Number(process.env.PORT ?? 3000)
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000"
const instanceId = process.env.GATEWAY_INSTANCE_ID ?? "gateway-1"
const aggregatorUrl = process.env.AGGREGATOR_URL ?? "http://localhost:4100"
const controllerUrl = process.env.CONTROLLER_URL ?? "http://localhost:5000"

const config = loadConfig()
const redis = createRedisClient()
const limiterClient = new LimiterClient(redis)
const circuitBreaker = new CircuitBreaker()
const fallbackLimiter = new FallbackLimiter({
  rate: Number(process.env.FALLBACK_TOKENS_PER_SECOND ?? 20),
  burst: Number(process.env.FALLBACK_BURST ?? 40)
})
const controllerClient = new ControllerClient({
  baseUrl: controllerUrl,
  refreshMs: Number(process.env.CONTROLLER_REFRESH_MS ?? 3000)
})
const metricsEmitter = new MetricsEmitter({
  instanceId,
  aggregatorUrl,
  controllerClient
})
const abuseEngine = new AbuseEngine()
const routeLatencies = new Map()

const app = Fastify({ logger: true })

function getRedisStatus() {
  return {
    status:
      circuitBreaker.state === "open"
        ? "degraded"
        : circuitBreaker.failures > 0
          ? "unstable"
          : "healthy",
    failures: circuitBreaker.failures
  }
}

function currentLatency(route) {
  return routeLatencies.get(route) ?? 0
}

async function proxyToBackend(request) {
  const target = new URL(request.raw.url, backendUrl)
  const response = await fetch(target, {
    method: request.method,
    headers: request.headers
  })
  const text = await response.text()

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: text
  }
}

function buildDecision({
  traceId,
  tenant,
  route,
  requestCost,
  decision,
  reason,
  creditsRemaining,
  retryAfterMs = 0,
  degraded = false,
  degradedMode = null
}) {
  return {
    traceId,
    tenantId: tenant?.tenantId ?? "anonymous",
    route,
    requestCost,
    decision,
    reason,
    creditsRemaining,
    retryAfterMs,
    degraded,
    degradedMode
  }
}

async function resolveLimiterDecision({ policy, tenant, route, requestCost }) {
  if (!circuitBreaker.allowRequest()) {
    throw new Error("circuit-open")
  }

  try {
    const result = await limiterClient.evaluate({ policy, tenant, route, requestCost })
    circuitBreaker.success()
    return result
  } catch (error) {
    circuitBreaker.failure()
    throw error
  }
}

function applyDegradedMode({ policy, tenant, route, requestCost }) {
  if (policy.degradedMode === "FAIL_OPEN") {
    return {
      allowed: true,
      remaining: tenant.creditBudget,
      retryAfterMs: 0,
      reason: "REDIS_UNAVAILABLE_FAIL_OPEN",
      degraded: true
    }
  }

  if (policy.degradedMode === "FAIL_CLOSED") {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: policy.windowMs,
      reason: "REDIS_UNAVAILABLE_FAIL_CLOSED",
      degraded: true
    }
  }

  const local = fallbackLimiter.consume(`${tenant.tenantId}:${route}`, requestCost)
  return {
    allowed: local.allowed,
    remaining: local.remaining,
    retryAfterMs: local.retryAfterMs,
    reason: local.allowed ? "REDIS_UNAVAILABLE_FAIL_SOFT" : "REDIS_UNAVAILABLE_FAIL_SOFT",
    degraded: true
  }
}

app.get("/health", async () => ({
  service: "gateway",
  status: "ok",
  redis: getRedisStatus(),
  controller: controllerClient.state
}))

app.all("/api/*", async (request, reply) => {
  const traceId = createTraceId()
  const route = new URL(request.raw.url, "http://sentinel.local").pathname
  const tenant = resolveTenant(request, config.tenantsByApiKey)

  if (!tenant) {
    const decision = buildDecision({
      traceId,
      tenant: { tenantId: "anonymous" },
      route,
      requestCost: 0,
      decision: "DENY",
      reason: "AUTH_REQUIRED",
      creditsRemaining: 0
    })
    applyDecisionHeaders(reply, decision)
    reply.code(401)
    return buildDenyBody(decision)
  }

  const policy = resolvePolicy(route, config.policiesByRoute)
  if (!policy) {
    const decision = buildDecision({
      traceId,
      tenant,
      route,
      requestCost: 0,
      decision: "DENY",
      reason: "ROUTE_NOT_CONFIGURED",
      creditsRemaining: tenant.creditBudget
    })
    applyDecisionHeaders(reply, decision)
    reply.code(404)
    return buildDenyBody(decision)
  }

  const cost = calculateRequestCost(route, config.costsByRoute, currentLatency(route))
  const effectiveBudget = Math.floor(tenant.creditBudget * (controllerClient.state.multiplier ?? 1))
  const shapedTenant = { ...tenant, creditBudget: Math.max(cost.effectiveCost, effectiveBudget) }

  const abuse = abuseEngine.evaluate({
    tenantId: tenant.tenantId,
    route,
    threshold: policy.abuseThreshold
  })

  if (abuse.blocked) {
    const decision = buildDecision({
      traceId,
      tenant,
      route,
      requestCost: cost.effectiveCost,
      decision: "DENY",
      reason: "ABUSE_SIGNAL_HIGH",
      creditsRemaining: 0
    })
    applyDecisionHeaders(reply, decision)
    metricsEmitter.record({ ...decision, redisStatus: getRedisStatus() })
    abuseEngine.observeResult({ tenantId: tenant.tenantId, denied: true, deniedReason: "ABUSE_SIGNAL_HIGH" })
    logDecision(decision)
    reply.code(429)
    return buildDenyBody(decision)
  }

  let limiterDecision
  try {
    limiterDecision = await resolveLimiterDecision({
      policy,
      tenant: shapedTenant,
      route,
      requestCost: cost.effectiveCost
    })
  } catch {
    limiterDecision = applyDegradedMode({
      policy,
      tenant: shapedTenant,
      route,
      requestCost: cost.effectiveCost
    })
  }

  const fairness = limiterDecision.degraded
    ? evaluateTenantFairness({
        tenant: shapedTenant,
        requestCost: cost.effectiveCost,
        currentSpend: shapedTenant.creditBudget - Math.max(0, limiterDecision.remaining ?? 0),
        totalSpend: Math.max(policy.globalCapacity, shapedTenant.creditBudget)
      })
    : { allowed: true, reason: "ALLOWED" }

  const reason = !limiterDecision.allowed
    ? limiterDecision.reason
    : !fairness.allowed
      ? fairness.reason
      : limiterDecision.degraded
        ? limiterDecision.reason
      : controllerClient.state.multiplier < 1
        ? "CONTROLLER_STRESS_REDUCTION"
        : "ALLOWED"

  if (!limiterDecision.allowed || !fairness.allowed) {
    const decision = buildDecision({
      traceId,
      tenant,
      route,
      requestCost: cost.effectiveCost,
      decision: "DENY",
      reason,
      creditsRemaining: limiterDecision.remaining ?? 0,
      retryAfterMs: limiterDecision.retryAfterMs ?? 0,
      degraded: limiterDecision.degraded ?? false,
      degradedMode: limiterDecision.degraded ? policy.degradedMode : null
    })
    applyDecisionHeaders(reply, decision)
    metricsEmitter.record({ ...decision, redisStatus: getRedisStatus() })
    abuseEngine.observeResult({ tenantId: tenant.tenantId, denied: true, deniedReason: reason })
    logDecision(decision)
    reply.code(429)
    return buildDenyBody(decision)
  }

  const backendResponse = await proxyToBackend(request)
  const latencyMs = Number(backendResponse.headers["x-backend-latency-ms"] ?? 0)
  routeLatencies.set(route, latencyMs)
  const backendError = backendResponse.status >= 500
  abuseEngine.observeResult({ tenantId: tenant.tenantId, backendError })

  const decision = buildDecision({
    traceId,
    tenant,
    route,
    requestCost: cost.effectiveCost,
    decision: "ALLOW",
    reason,
    creditsRemaining: limiterDecision.remaining ?? 0,
    degraded: limiterDecision.degraded ?? false,
    degradedMode: limiterDecision.degraded ? policy.degradedMode : null
  })

  applyDecisionHeaders(reply, decision)
  for (const [header, value] of Object.entries(backendResponse.headers)) {
    if (!header.startsWith("x-sentinel")) {
      reply.header(header, value)
    }
  }

  metricsEmitter.record({
    ...decision,
    latencyMs,
    baseCost: cost.baseCost,
    dynamicMultiplier: cost.dynamicMultiplier,
    latencyBand: cost.latencyBand,
    backendError,
    redisStatus: getRedisStatus()
  })
  logDecision(decision)
  reply.code(backendResponse.status)
  return backendResponse.body
})

setInterval(() => {
  metricsEmitter.flush().catch((error) => {
    app.log.error(error)
  })
}, 1000).unref()

limiterClient.loadScripts()
  .catch((error) => {
    app.log.warn({ err: error }, "redis scripts could not be preloaded; gateway will start in degraded-ready mode")
  })
  .finally(() => {
    app.listen({ port, host: "0.0.0.0" }).catch((error) => {
      app.log.error(error)
      process.exit(1)
    })
  })
