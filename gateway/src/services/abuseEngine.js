export class AbuseEngine {
  constructor() {
    this.routeScores = new Map()
    this.tenantState = new Map()
  }

  getTenantState(tenantId) {
    const state = this.tenantState.get(tenantId) ?? {
      recentRoutes: new Map(),
      deniedStreak: 0,
      backendErrors: 0,
      lastSeenAt: 0
    }
    this.tenantState.set(tenantId, state)
    return state
  }

  evaluate({ tenantId, route, threshold = 10 }) {
    const key = `${tenantId}:${route}`
    const currentState = this.routeScores.get(key) ?? { score: 0, updatedAt: Date.now() }
    const tenant = this.getTenantState(tenantId)
    const now = Date.now()
    tenant.lastSeenAt = now
    const elapsedMs = Math.max(0, now - currentState.updatedAt)
    const scoreDecay = Math.pow(0.72, elapsedMs / 4_000)
    const current = currentState.score * scoreDecay

    const cutoff = now - 30_000
    for (const [seenRoute, ts] of tenant.recentRoutes.entries()) {
      if (ts < cutoff) {
        tenant.recentRoutes.delete(seenRoute)
      }
    }
    tenant.recentRoutes.set(route, now)

    const routeFanout = tenant.recentRoutes.size
    const next = Math.max(
      0,
      current +
      0.28 +
      Math.max(0, routeFanout - 2) * 0.25 +
      tenant.deniedStreak * 0.18 +
      tenant.backendErrors * 0.22
    )
    this.routeScores.set(key, { score: next, updatedAt: now })

    return {
      score: next,
      routeFanout,
      blocked: next >= threshold
    }
  }

  observeResult({ tenantId, denied = false, backendError = false, deniedReason = null }) {
    const tenant = this.getTenantState(tenantId)
    if (denied && deniedReason !== "ABUSE_SIGNAL_HIGH") {
      tenant.deniedStreak = Math.min(tenant.deniedStreak + 1, 4)
    } else {
      tenant.deniedStreak = Math.max(tenant.deniedStreak - 2, 0)
    }
    tenant.backendErrors = backendError ? Math.min(tenant.backendErrors + 1, 5) : Math.max(tenant.backendErrors - 1, 0)
  }
}
