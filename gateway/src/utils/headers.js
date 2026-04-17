export function applyDecisionHeaders(reply, decision) {
  reply.header("X-Sentinel-Decision", decision.decision)
  reply.header("X-Sentinel-Reason", decision.reason)
  reply.header("X-Sentinel-TraceId", decision.traceId)
  reply.header("X-Credits-Remaining", String(decision.creditsRemaining ?? 0))
  reply.header("X-Request-Cost", String(decision.requestCost ?? 0))
  reply.header("X-Sentinel-Degraded", String(Boolean(decision.degraded)))
}

export function buildDenyBody(decision) {
  return {
    traceId: decision.traceId,
    decision: decision.decision,
    reason: decision.reason,
    tenantId: decision.tenantId,
    route: decision.route,
    requestCost: decision.requestCost,
    creditsRemaining: decision.creditsRemaining,
    retryAfterMs: decision.retryAfterMs,
    degradedMode: decision.degradedMode
  }
}

