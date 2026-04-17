export class FallbackLimiter {
  constructor({ rate = 20, burst = 40 } = {}) {
    this.rate = rate
    this.burst = burst
    this.buckets = new Map()
  }

  consume(key, cost) {
    const now = Date.now()
    const bucket = this.buckets.get(key) ?? { tokens: this.burst, ts: now }
    const elapsedSeconds = Math.max(0, (now - bucket.ts) / 1000)
    bucket.tokens = Math.min(this.burst, bucket.tokens + elapsedSeconds * this.rate)
    bucket.ts = now

    if (bucket.tokens < cost) {
      this.buckets.set(key, bucket)
      return {
        allowed: false,
        remaining: Math.max(0, Math.floor(bucket.tokens)),
        retryAfterMs: Math.ceil(((cost - bucket.tokens) / this.rate) * 1000)
      }
    }

    bucket.tokens -= cost
    this.buckets.set(key, bucket)
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: 0
    }
  }
}

