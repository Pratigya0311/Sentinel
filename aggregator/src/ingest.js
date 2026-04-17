import { RollingWindow } from "./rollingWindow.js"
import { topK } from "./topk.js"

function emptySummary() {
  return {
    totalRequests: 0,
    allowedCount: 0,
    blockedCount: 0,
    creditsConsumed: 0,
    reasons: {},
    routes: {},
    tenants: {},
    instances: {},
    redis: { status: "unknown", failures: 0 },
    controller: { multiplier: 1, health: "unknown", reason: "UNINITIALIZED" },
    degraded: { active: false, modes: {} }
  }
}

export class MetricsStore {
  constructor() {
    this.window = new RollingWindow(120)
    this.byBucket = new Map()
  }

  ingest(tick) {
    const key = `${tick.instanceId}:${tick.bucket}`
    this.byBucket.set(key, tick)

    const cutoff = Date.now() - 120_000
    for (const [bucketKey, value] of this.byBucket.entries()) {
      if (value.bucket < cutoff) {
        this.byBucket.delete(bucketKey)
      }
    }

    this.window.push(tick)
  }

  snapshot() {
    const summary = emptySummary()
    const history = []
    const controllerHistory = []
    const degradedTimeline = []
    const redisTimeline = []
    const instanceSeries = {}

    for (const tick of this.byBucket.values()) {
      summary.totalRequests += tick.totalRequests
      summary.allowedCount += tick.allowedCount
      summary.blockedCount += tick.blockedCount
      summary.creditsConsumed += tick.creditsConsumed

      for (const [reason, count] of Object.entries(tick.reasons ?? {})) {
        summary.reasons[reason] = (summary.reasons[reason] ?? 0) + count
      }

      for (const [route, routeStats] of Object.entries(tick.routes ?? {})) {
        const current = summary.routes[route] ?? { requests: 0, credits: 0, latencyP95: 0 }
        current.requests += routeStats.requests ?? 0
        current.credits += routeStats.credits ?? 0
        current.latencyP95 = Math.max(current.latencyP95, routeStats.latencyP95 ?? 0)
        summary.routes[route] = current
      }

      for (const [tenantId, tenantStats] of Object.entries(tick.tenants ?? {})) {
        const current = summary.tenants[tenantId] ?? { requests: 0, credits: 0, denied: 0 }
        current.requests += tenantStats.requests ?? 0
        current.credits += tenantStats.credits ?? 0
        current.denied += tenantStats.denied ?? 0
        summary.tenants[tenantId] = current
      }

      for (const [instanceId, instanceStats] of Object.entries(tick.instances ?? {})) {
        const current = summary.instances[instanceId] ?? {
          totalRequests: 0,
          allowedCount: 0,
          blockedCount: 0
        }
        current.totalRequests += instanceStats.totalRequests ?? 0
        current.allowedCount += instanceStats.allowedCount ?? 0
        current.blockedCount += instanceStats.blockedCount ?? 0
        summary.instances[instanceId] = current
      }

      if (tick.redis) {
        summary.redis = tick.redis
      }

      if (tick.controller) {
        summary.controller = tick.controller
        controllerHistory.push({
          bucket: tick.bucket,
          multiplier: tick.controller.multiplier,
          health: tick.controller.health,
          reason: tick.controller.reason
        })
      }

      if (tick.degraded?.active) {
        summary.degraded.active = true
        summary.degraded.modes[tick.instanceId] = tick.degraded.modes ?? {}
        degradedTimeline.push({
          bucket: tick.bucket,
          instanceId: tick.instanceId,
          modes: tick.degraded.modes ?? {}
        })
      }

      redisTimeline.push({
        bucket: tick.bucket,
        status: tick.redis?.status ?? "unknown",
        failures: tick.redis?.failures ?? 0
      })

      history.push({
        bucket: tick.bucket,
        instanceId: tick.instanceId,
        totalRequests: tick.totalRequests,
        allowedCount: tick.allowedCount,
        blockedCount: tick.blockedCount,
        creditsConsumed: tick.creditsConsumed
      })

      instanceSeries[tick.instanceId] ??= []
      instanceSeries[tick.instanceId].push({
        bucket: tick.bucket,
        totalRequests: tick.totalRequests,
        allowedCount: tick.allowedCount,
        blockedCount: tick.blockedCount
      })
    }

    const sortedHistory = history.sort((left, right) => left.bucket - right.bucket).slice(-60)
    return {
      generatedAt: new Date().toISOString(),
      totals: summary,
      currentRps: summary.totalRequests,
      blockedRatio: summary.totalRequests === 0 ? 0 : Number((summary.blockedCount / summary.totalRequests).toFixed(3)),
      instances: Object.entries(summary.instances)
        .map(([instanceId, stats]) => ({ instanceId, ...stats }))
        .sort((left, right) => right.totalRequests - left.totalRequests),
      topTenants: topK(summary.tenants, 6, "credits"),
      topEndpoints: topK(summary.routes, 6, "credits"),
      topReasons: Object.entries(summary.reasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 6),
      history: sortedHistory,
      controllerHistory: controllerHistory.sort((left, right) => left.bucket - right.bucket).slice(-60),
      degradedTimeline: degradedTimeline.sort((left, right) => left.bucket - right.bucket).slice(-60),
      redisTimeline: redisTimeline.sort((left, right) => left.bucket - right.bucket).slice(-60),
      instanceSeries: Object.fromEntries(
        Object.entries(instanceSeries).map(([instanceId, points]) => [
          instanceId,
          points.sort((left, right) => left.bucket - right.bucket).slice(-60)
        ])
      )
    }
  }
}
