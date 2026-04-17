export class MetricsEmitter {
  constructor({ instanceId, aggregatorUrl, controllerClient }) {
    this.instanceId = instanceId
    this.aggregatorUrl = aggregatorUrl
    this.controllerClient = controllerClient
    this.current = this.createBucket()
    this.lastSignals = {
      p95LatencyMs: 0,
      errorRate: 0,
      blockedRatio: 0,
      throughput: 0
    }
  }

  createBucket() {
    return {
      bucket: Date.now(),
      instanceId: this.instanceId,
      totalRequests: 0,
      allowedCount: 0,
      blockedCount: 0,
      creditsConsumed: 0,
      reasons: {},
      routes: {},
      tenants: {},
      instances: {},
      redis: { status: "healthy", failures: 0 },
      controller: { ...this.controllerClient.state },
      degraded: { active: false, modes: {} },
      latencies: []
    }
  }

  record(event) {
    const bucket = this.current
    bucket.totalRequests += 1
    bucket.creditsConsumed += event.requestCost ?? 0
    bucket.reasons[event.reason] = (bucket.reasons[event.reason] ?? 0) + 1

    if (event.decision === "ALLOW") {
      bucket.allowedCount += 1
    } else {
      bucket.blockedCount += 1
    }

    bucket.instances[this.instanceId] = {
      totalRequests: bucket.totalRequests,
      allowedCount: bucket.allowedCount,
      blockedCount: bucket.blockedCount
    }

    if (event.degraded) {
      bucket.degraded.active = true
      bucket.degraded.modes[event.degradedMode] = (bucket.degraded.modes[event.degradedMode] ?? 0) + 1
    }

    if (event.redisStatus) {
      bucket.redis = event.redisStatus
    }

    if (typeof event.latencyMs === "number") {
      bucket.latencies.push(event.latencyMs)
    }

    const routeStats = bucket.routes[event.route] ?? {
      requests: 0,
      credits: 0,
      latencyP95: 0,
      dynamicMultiplier: 1,
      latencyBand: "normal",
      backendErrors: 0
    }
    routeStats.requests += 1
    routeStats.credits += event.requestCost ?? 0
    routeStats.latencyP95 = Math.max(routeStats.latencyP95, event.latencyMs ?? 0)
    routeStats.dynamicMultiplier = Math.max(routeStats.dynamicMultiplier, event.dynamicMultiplier ?? 1)
    routeStats.latencyBand = event.latencyBand ?? routeStats.latencyBand
    routeStats.backendErrors += event.backendError ? 1 : 0
    bucket.routes[event.route] = routeStats

    const tenantStats = bucket.tenants[event.tenantId] ?? { requests: 0, credits: 0, denied: 0 }
    tenantStats.requests += 1
    tenantStats.credits += event.requestCost ?? 0
    tenantStats.denied += event.decision === "DENY" ? 1 : 0
    bucket.tenants[event.tenantId] = tenantStats
  }

  async flush() {
    const latencies = [...this.current.latencies].sort((left, right) => left - right)
    const p95Index = latencies.length === 0 ? 0 : Math.floor(latencies.length * 0.95) - 1
    const p95LatencyMs = latencies.length === 0 ? 0 : latencies[Math.max(0, p95Index)]
    const blockedRatio = this.current.totalRequests === 0 ? 0 : this.current.blockedCount / this.current.totalRequests
    const backendErrors = Object.values(this.current.routes)
      .reduce((sum, route) => sum + (route.backendErrors ?? 0), 0)

    this.lastSignals = {
      p95LatencyMs,
      errorRate: this.current.totalRequests === 0 ? 0 : backendErrors / this.current.totalRequests,
      blockedRatio,
      throughput: this.current.totalRequests
    }

    const controllerState = await this.controllerClient.sync(this.lastSignals)
    this.current.controller = controllerState

    const payload = { ...this.current }
    delete payload.latencies

    try {
      await fetch(`${this.aggregatorUrl}/ticks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      })
    } catch {
      // Dashboard visibility is best effort for the demo.
    }

    this.current = this.createBucket()
  }
}
