import Redis from "ioredis"

export function createRedisClient() {
  const sentinels = String(process.env.REDIS_SENTINELS ?? "127.0.0.1:26379")
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [host, port] = entry.split(":")
      return { host, port: Number(port) }
    })

  return new Redis({
    sentinels,
    name: process.env.REDIS_MASTER_NAME ?? "mymaster",
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 1500),
    sentinelRetryStrategy: (times) => Math.min(times * 250, 2000),
    retryStrategy: (times) => Math.min(times * 200, 1000),
    maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES ?? 2),
    enableOfflineQueue: false
  })
}
