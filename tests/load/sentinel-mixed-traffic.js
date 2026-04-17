import http from "k6/http"
import { sleep } from "k6"

export const options = {
  vus: 10,
  duration: "30s"
}

const apiKeys = [
  "sentinel-free-key",
  "sentinel-pro-key",
  "sentinel-enterprise-key"
]

const routes = ["/api/health", "/api/user", "/api/search?q=governance", "/api/export"]

export default function () {
  const route = routes[Math.floor(Math.random() * routes.length)]
  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]

  http.get(`http://localhost:3000${route}`, {
    headers: {
      "x-api-key": apiKey
    }
  })

  sleep(1)
}

