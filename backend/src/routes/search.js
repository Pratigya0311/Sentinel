import { setTimeout as delay } from "node:timers/promises"

export async function searchRoute(request) {
  const slow = Number(request.query.slow ?? 0)
  const errorRate = Number(request.query.errorRate ?? 0)
  const latency = slow > 0 ? slow : 80 + Math.floor(Math.random() * 220)
  await delay(latency)

  if (errorRate > 0 && Math.random() < errorRate) {
    throw new Error("SEARCH_INDEX_UNAVAILABLE")
  }

  return {
    query: request.query.q ?? "sentinel",
    hits: Math.max(1, Math.floor(Math.random() * 15)),
    latencyMs: latency
  }
}
