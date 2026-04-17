import { setTimeout as delay } from "node:timers/promises"

export async function userRoute(request, reply) {
  const slow = Number(request.query.slow ?? 0)
  const errorRate = Number(request.query.errorRate ?? 0)
  if (slow > 0) {
    await delay(slow)
  }

  if (errorRate > 0 && Math.random() < errorRate) {
    reply.code(502)
    return {
      reason: "USER_PROFILE_BACKEND_ERROR",
      generatedAt: new Date().toISOString()
    }
  }

  return {
    userId: request.query.id ?? "u-demo",
    plan: "pro",
    flags: ["search", "export-preview"],
    generatedAt: new Date().toISOString()
  }
}
