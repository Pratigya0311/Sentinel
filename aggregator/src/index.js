import Fastify from "fastify"
import { MetricsStore } from "./ingest.js"
import { SseHub } from "./stream.js"

const app = Fastify({ logger: true })
const port = Number(process.env.PORT ?? 4100)
const store = new MetricsStore()
const hub = new SseHub()

app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*")
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  reply.header("Access-Control-Allow-Headers", "Content-Type,Accept")

  if (request.method === "OPTIONS") {
    reply.code(204)
    return reply.send()
  }
})

app.get("/health", async () => ({ service: "aggregator", status: "ok" }))

app.post("/ticks", async (request, reply) => {
  store.ingest(request.body)
  const snapshot = store.snapshot()
  hub.publish("snapshot", snapshot)
  reply.code(202)
  return { accepted: true }
})

app.get("/snapshot", async () => store.snapshot())

app.get("/events", async (request, reply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  })
  reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(store.snapshot())}\n\n`)
  hub.add(reply)
})

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error)
  process.exit(1)
})
