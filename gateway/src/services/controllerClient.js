export class ControllerClient {
  constructor({ baseUrl, refreshMs }) {
    this.baseUrl = baseUrl
    this.refreshMs = refreshMs
    this.state = {
      multiplier: 1,
      health: "unknown",
      reason: "UNINITIALIZED"
    }
  }

  async sync(signal) {
    try {
      const response = await fetch(`${this.baseUrl}/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signal)
      })

      if (!response.ok) {
        throw new Error(`controller status ${response.status}`)
      }

      this.state = await response.json()
    } catch {
      this.state = {
        ...this.state,
        multiplier: this.state.multiplier || 1,
        health: "degraded",
        reason: "CONTROLLER_UNAVAILABLE"
      }
    }

    return this.state
  }
}

