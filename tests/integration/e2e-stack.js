import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

const compose = process.platform === "win32" ? "docker-compose" : "docker-compose"
const gatewayBase = "http://127.0.0.1:3000"
const gatewayBase2 = "http://127.0.0.1:3001"
const aggregatorBase = "http://127.0.0.1:4100"

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

async function request(path, { apiKey, expectedStatus, baseUrl = gatewayBase } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: apiKey ? { "x-api-key": apiKey } : {}
  })
  const text = await response.text()
  let body = text

  try {
    body = JSON.parse(text)
  } catch {
    // Keep raw payload for debugging.
  }

  if (typeof expectedStatus === "number") {
    assert.equal(response.status, expectedStatus, `Unexpected status for ${path}: ${text}`)
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body
  }
}

async function snapshot() {
  const response = await fetch(`${aggregatorBase}/snapshot`)
  assert.equal(response.status, 200)
  return response.json()
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

function flushRedis(containerName) {
  return run("docker", ["exec", containerName, "redis-cli", "FLUSHALL"])
}

async function assertSnapshotReason(expectedReason) {
  await waitFor(`snapshot reason ${expectedReason}`, async () => {
    const data = await snapshot()
    assert.ok((data.totals.reasons?.[expectedReason] ?? 0) >= 1, JSON.stringify(data.totals, null, 2))
    return data
  })
}

async function main() {
  console.log("Bringing up Docker stack...")
  run(compose, [
    "up",
    "--build",
    "-d",
    "--force-recreate",
    "redis-primary",
    "redis-replica-1",
    "redis-replica-2",
    "redis-sentinel-1",
    "redis-sentinel-2",
    "redis-sentinel-3",
    "backend",
    "controller",
    "aggregator",
    "gateway",
    "gateway-2",
    "dashboard"
  ], { cwd: process.cwd() })

  try {
    run(compose, ["stop", "demo-runner"], { cwd: process.cwd() })
  } catch {
    // Ignore if the demo runner is not active.
  }

  await waitFor("gateway health", async () => {
    const response = await fetch(`${gatewayBase}/health`)
    assert.equal(response.status, 200)
  })

  await waitFor("second gateway health", async () => {
    const response = await fetch(`${gatewayBase2}/health`)
    assert.equal(response.status, 200)
  })

  console.log("Resetting Redis state for deterministic verification...")
  const masterAtStart = currentMasterHost()
  flushRedis(hostToContainer(masterAtStart))

  console.log("Asserting normal routed traffic...")
  const allowHealth = await request("/api/health", {
    apiKey: "sentinel-free-key",
    expectedStatus: 200
  })
  assert.equal(allowHealth.headers["x-sentinel-decision"], "ALLOW")
  assert.equal(allowHealth.headers["x-sentinel-degraded"], "false")

  const allowSearch = await request("/api/search?q=sentinel", {
    apiKey: "sentinel-pro-key",
    expectedStatus: 200
  })
  assert.equal(allowSearch.headers["x-sentinel-decision"], "ALLOW")
  assert.equal(allowSearch.headers["x-sentinel-reason"], "ALLOWED")

  const allowSearchSecondGateway = await request("/api/search?q=sentinel&slow=220", {
    apiKey: "sentinel-enterprise-key",
    expectedStatus: 200,
    baseUrl: gatewayBase2
  })
  assert.equal(allowSearchSecondGateway.headers["x-sentinel-decision"], "ALLOW")

  await assertSnapshotReason("ALLOWED")

  await waitFor("aggregator sees both gateway instances", async () => {
    const data = await snapshot()
    const instances = new Set(data.history.map((item) => item.instanceId))
    assert.ok(instances.has("gateway-1"), JSON.stringify(data.history, null, 2))
    assert.ok(instances.has("gateway-2"), JSON.stringify(data.history, null, 2))
  })

  console.log("Asserting distributed cross-instance budget enforcement...")
  const distributedCycle = [
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase },
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase2 },
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase },
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase2 },
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase },
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase2 },
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase },
    { apiKey: "sentinel-enterprise-key", baseUrl: gatewayBase2 }
  ]

  for (const step of distributedCycle) {
    const response = await request("/api/export?rows=1000&slow=180&errorRate=0", {
      apiKey: step.apiKey,
      expectedStatus: 200,
      baseUrl: step.baseUrl
    })
    assert.equal(response.headers["x-sentinel-decision"], "ALLOW")
  }

  const globalDenied = await request("/api/export?rows=1000&slow=180&errorRate=0", {
    apiKey: "sentinel-pro-key",
    expectedStatus: 429,
    baseUrl: gatewayBase2
  })
  assert.equal(globalDenied.headers["x-sentinel-decision"], "DENY")
  assert.equal(globalDenied.headers["x-sentinel-reason"], "GLOBAL_CAPACITY_PROTECTED")

  console.log("Verifying Sentinel quorum before failover...")
  const beforeFailover = sentinelMaster()
  assert.ok(beforeFailover.includes("num-other-sentinels\n2"), beforeFailover)
  const masterBeforeFailover = currentMasterHost()

  console.log("Forcing Redis primary failover...")
  run("docker", ["stop", hostToContainer(masterBeforeFailover)])

  const mastersAfterFailover = await waitFor("Sentinel promotion", async () => {
    const output = sentinelMaster()
    assert.ok(!output.includes(`ip\n${masterBeforeFailover}`), output)
    assert.ok(output.includes("flags\nmaster"), output)
    return output
  }, 90000, 3000)

  assert.ok(!mastersAfterFailover.includes(`ip\n${masterBeforeFailover}`), mastersAfterFailover)

  const replica1 = replicationInfo("sentinel-redis-replica-1-1")
  const replica2 = replicationInfo("sentinel-redis-replica-2-1")
  assert.ok(replica1.includes("role:master") || replica2.includes("role:master"), `${replica1}\n${replica2}`)

  await waitFor("gateway survives failover", async () => {
    const response = await request("/api/health", {
      apiKey: "sentinel-enterprise-key",
      expectedStatus: 200
    })
    assert.equal(response.headers["x-sentinel-decision"], "ALLOW")
  }, 60000, 3000)

  await waitFor("second gateway survives failover", async () => {
    const response = await request("/api/health", {
      apiKey: "sentinel-enterprise-key",
      expectedStatus: 200,
      baseUrl: gatewayBase2
    })
    assert.equal(response.headers["x-sentinel-decision"], "ALLOW")
  }, 60000, 3000)

  console.log("Forcing controller outage while keeping traffic flowing...")
  run("docker", ["stop", "sentinel-controller-1"])

  await waitFor("controller degraded state on gateway", async () => {
    const response = await fetch(`${gatewayBase}/health`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.controller.health, "degraded")
    assert.equal(body.controller.reason, "CONTROLLER_UNAVAILABLE")
  }, 30000, 3000)

  const controllerOutageTraffic = await request("/api/user?id=controller-check", {
    apiKey: "sentinel-enterprise-key",
    expectedStatus: 200,
    baseUrl: gatewayBase2
  })
  assert.equal(controllerOutageTraffic.headers["x-sentinel-decision"], "ALLOW")

  run(compose, ["up", "-d", "controller", "gateway", "gateway-2"], {
    cwd: process.cwd()
  })

  await waitFor("controller recovery", async () => {
    const response = await fetch(`${gatewayBase}/health`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.notEqual(body.controller.reason, "CONTROLLER_UNAVAILABLE")
  }, 90000, 3000)

  console.log("Forcing full Redis outage for degraded-mode validation...")
  run("docker", ["stop", "sentinel-redis-replica-1-1", "sentinel-redis-replica-2-1"])
  run("docker", ["stop", "sentinel-redis-sentinel-1-1", "sentinel-redis-sentinel-2-1", "sentinel-redis-sentinel-3-1"])

  const degradedHealth = await waitFor("FAIL_OPEN path", async () => {
    const response = await request("/api/health", {
      apiKey: "sentinel-free-key",
      expectedStatus: 200
    })
    assert.equal(response.headers["x-sentinel-degraded"], "true")
    assert.equal(response.headers["x-sentinel-reason"], "REDIS_UNAVAILABLE_FAIL_OPEN")
    return response
  }, 90000, 4000)
  assert.equal(degradedHealth.headers["x-sentinel-decision"], "ALLOW")

  const degradedExport = await waitFor("FAIL_CLOSED path", async () => {
    const response = await request("/api/export", {
      apiKey: "sentinel-free-key",
      expectedStatus: 429
    })
    assert.equal(response.headers["x-sentinel-degraded"], "true")
    assert.equal(response.headers["x-sentinel-reason"], "REDIS_UNAVAILABLE_FAIL_CLOSED")
    return response
  }, 90000, 4000)
  assert.equal(degradedExport.body.degradedMode, "FAIL_CLOSED")

  await assertSnapshotReason("REDIS_UNAVAILABLE_FAIL_OPEN")
  await assertSnapshotReason("REDIS_UNAVAILABLE_FAIL_CLOSED")

  console.log("Restoring stack...")
  run(compose, ["up", "-d", "redis-primary", "redis-replica-1", "redis-replica-2", "redis-sentinel-1", "redis-sentinel-2", "redis-sentinel-3", "gateway"], {
    cwd: process.cwd()
  })
  run(compose, ["up", "-d", "gateway-2"], {
    cwd: process.cwd()
  })

  await waitFor("post-restore gateway health", async () => {
    const response = await fetch(`${gatewayBase}/health`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.status, "ok")
  }, 90000, 3000)

  await waitFor("post-restore second gateway health", async () => {
    const response = await fetch(`${gatewayBase2}/health`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.status, "ok")
  }, 90000, 3000)

  console.log("E2E verification passed.")
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
