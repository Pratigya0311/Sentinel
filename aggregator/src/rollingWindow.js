export class RollingWindow {
  constructor(limit = 60) {
    this.limit = limit
    this.items = []
  }

  push(item) {
    this.items.push(item)
    if (this.items.length > this.limit) {
      this.items.shift()
    }
  }

  values() {
    return [...this.items]
  }

  latest(count = this.limit) {
    return this.items.slice(-count)
  }
}
