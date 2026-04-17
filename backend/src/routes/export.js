import { setTimeout as delay } from "node:timers/promises"

export async function exportRoute(request, reply) {
  const slow = Number(request.query.slow ?? 900)
  const errorRate = Number(request.query.errorRate ?? 0.15)
  await delay(slow)

  if (Math.random() < errorRate) {
    reply.code(503)
    return {
      status: "failed",
      reason: "EXPORT_PIPELINE_BUSY",
      latencyMs: slow
    }
  }

  return {
    status: "ready",
    artifactId: `exp-${Date.now()}`,
    latencyMs: slow
  }
}

