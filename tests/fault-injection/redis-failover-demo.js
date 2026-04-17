import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

const gatewayBase = "http://127.0.0.1:3000"
const gatewayBase2 = "http://127.0.0.1:3001"
const restoreDelayMs = Number(process.env.FAILOVER_RESTORE_DELAY_MS ?? 12000)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options
  })

  if (result.status !== 0) {
    const rendered = [result.stdout, result.stderr].filter(Boolean).join("\n")
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${rendered}`)
  }

  return result.stdout.trim()
}

async function waitFor(description, fn, timeoutMs = 90000, intervalMs = 2000) {
  const started = Date.now()
  let lastError

  while (Date.now() - started < timeoutMs) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  throw new Error(`Timed out waiting for ${description}: ${lastError?.message ?? "unknown error"}`)
}

function sentinelMaster() {
  return run("docker", [
    "exec",
    "sentinel-redis-sentinel-1-1",
    "redis-cli",
    "-p",
    "26379",
    "SENTINEL",
    "masters"
  ])
}

function currentMasterHost() {
  const output = sentinelMaster()
  const match = output.match(/ip\n([^\n]+)/)
  if (!match) {
    throw new Error(`Unable to parse current master from:\n${output}`)
  }
  return match[1]
}

function hostToContainer(host) {
  if (host === "redis-primary") {
    return "sentinel-redis-primary-1"
  }
  if (host === "redis-replica-1") {
    return "sentinel-redis-replica-1-1"
  }
  if (host === "redis-replica-2") {
    return "sentinel-redis-replica-2-1"
  }
  throw new Error(`Unknown Redis host ${host}`)
}

function replicationInfo(containerName) {
  return run("docker", ["exec", containerName, "redis-cli", "INFO", "replication"])
}

async function request(path, baseUrl) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "x-api-key": "sentinel-enterprise-key" }
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: text
  }
}

async function main() {
  console.log("=== Redis Sentinel failover demo ===")
  console.log("Checking current master...")
  const before = currentMasterHost()
  console.log(`Current master: ${before}`)

  console.log("Checking gateways before failover...")
  const beforeGateway1 = await request("/api/health", gatewayBase)
  const beforeGateway2 = await request("/api/health", gatewayBase2)
  assert.equal(beforeGateway1.status, 200)
  assert.equal(beforeGateway2.status, 200)
  console.log(`Gateway 1 pre-failover: ${beforeGateway1.headers["x-sentinel-decision"]} ${beforeGateway1.headers["x-sentinel-reason"]}`)
  console.log(`Gateway 2 pre-failover: ${beforeGateway2.headers["x-sentinel-decision"]} ${beforeGateway2.headers["x-sentinel-reason"]}`)

  const masterContainer = hostToContainer(before)
  console.log(`Stopping current master container: ${masterContainer}`)
  run("docker", ["stop", masterContainer])

  const promoted = await waitFor("Sentinel replica promotion", async () => {
    const next = currentMasterHost()
    assert.notEqual(next, before)
    return next
  }, 90000, 3000)

  console.log(`New promoted master: ${promoted}`)
  console.log("Replication roles after failover:")
  console.log("--- replica 1 ---")
  console.log(replicationInfo("sentinel-redis-replica-1-1"))
  console.log("--- replica 2 ---")
  console.log(replicationInfo("sentinel-redis-replica-2-1"))

  console.log("Verifying gateway traffic survives failover...")
  const afterGateway1 = await waitFor("gateway-1 traffic after failover", async () => {
    const response = await request("/api/health", gatewayBase)
    assert.equal(response.status, 200)
    assert.equal(response.headers["x-sentinel-decision"], "ALLOW")
    return response
  }, 60000, 3000)

  const afterGateway2 = await waitFor("gateway-2 traffic after failover", async () => {
    const response = await request("/api/health", gatewayBase2)
    assert.equal(response.status, 200)
    assert.equal(response.headers["x-sentinel-decision"], "ALLOW")
    return response
  }, 60000, 3000)

  console.log(`Gateway 1 post-failover: ${afterGateway1.headers["x-sentinel-decision"]} ${afterGateway1.headers["x-sentinel-reason"]}`)
  console.log(`Gateway 2 post-failover: ${afterGateway2.headers["x-sentinel-decision"]} ${afterGateway2.headers["x-sentinel-reason"]}`)

  console.log(`Waiting ${Math.round(restoreDelayMs / 1000)}s so the failover is visible before restoring the old primary...`)
  await new Promise((resolve) => setTimeout(resolve, restoreDelayMs))

  console.log(`Restarting previous master container: ${masterContainer}`)
  run("docker", ["start", masterContainer])

  await waitFor("previous master rejoins replication", async () => {
    const info = replicationInfo(masterContainer)
    assert.ok(info.includes("role:slave") || info.includes("role:replica"), info)
    return info
  }, 90000, 3000)

  console.log("Previous master rejoined as replica.")
  console.log("=== Failover demo completed successfully ===")
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
