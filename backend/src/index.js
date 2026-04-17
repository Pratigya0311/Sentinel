import Fastify from "fastify"
import { healthRoute } from "./routes/health.js"
import { userRoute } from "./routes/user.js"
import { searchRoute } from "./routes/search.js"
import { exportRoute } from "./routes/export.js"

const app = Fastify({ logger: true })
const port = Number(process.env.PORT ?? 4000)

app.addHook("onRequest", async (request) => {
  request.startTime = performance.now()
})

app.addHook("onSend", async (request, reply, payload) => {
  const latencyMs = Math.round(performance.now() - request.startTime)
  reply.header("x-backend-latency-ms", latencyMs)
  reply.header("x-backend-route", request.routerPath ?? request.url)
  return payload
})

app.setErrorHandler((error, request, reply) => {
  reply.code(503).send({
    error: error.message,
    route: request.url,
    status: "backend_error"
  })
})

app.get("/health", async (request, reply) => healthRoute(request, reply))
app.get("/api/health", async (request, reply) => healthRoute(request, reply))
app.get("/api/user", async (request, reply) => userRoute(request, reply))
app.get("/api/search", async (request) => searchRoute(request))
app.get("/api/export", async (request, reply) => exportRoute(request, reply))

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error)
  process.exit(1)
})
