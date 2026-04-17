export class CircuitBreaker {
  constructor({ failureThreshold = 3, cooldownMs = 5000 } = {}) {
    this.failureThreshold = failureThreshold
    this.cooldownMs = cooldownMs
    this.failures = 0
    this.state = "closed"
    this.openedAt = 0
  }

  allowRequest() {
    if (this.state === "open" && Date.now() - this.openedAt > this.cooldownMs) {
      this.state = "half-open"
      return true
    }

    return this.state !== "open"
  }

  success() {
    this.failures = 0
    this.state = "closed"
  }

  failure() {
    this.failures += 1
    if (this.failures >= this.failureThreshold) {
      this.state = "open"
      this.openedAt = Date.now()
    }
  }
}

