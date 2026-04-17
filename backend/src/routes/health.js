import { setTimeout as delay } from "node:timers/promises"

export async function healthRoute(request, reply) {
  const slow = Number(request?.query?.slow ?? 0)
  const unhealthy = String(request?.query?.mode ?? "ok") === "unhealthy"

  if (slow > 0) {
    await delay(slow)
  }

  if (unhealthy) {
    reply.code(503)
  }

  return {
    service: "backend",
    status: unhealthy ? "degraded" : "ok",
    timestamp: new Date().toISOString()
  }
}
