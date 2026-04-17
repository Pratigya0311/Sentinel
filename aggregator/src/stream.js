export class SseHub {
  constructor() {
    this.clients = new Set()
  }

  add(reply) {
    this.clients.add(reply)
    reply.raw.on("close", () => {
      this.clients.delete(reply)
    })
  }

  publish(event, payload) {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
    for (const client of this.clients) {
      client.raw.write(data)
    }
  }
}

