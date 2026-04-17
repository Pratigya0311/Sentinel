import { execSync } from "node:child_process"

const args = new Set(process.argv.slice(2))
const burstMode = args.has("--burst")
const liveMode = args.has("--live")
const redisBlipMode = args.has("--redis-blip")

const gateways = (process.env.GATEWAYS ?? "http://127.0.0.1:3000,http://127.0.0.1:3001")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

const tenants = {
  free: { apiKey: "sentinel-free-key" },
  pro: { apiKey: "sentinel-pro-key" },
  enterprise: { apiKey: "sentinel-enterprise-key" }
}

const phasePlans = {
  baseline: {
    parallel: 2,
    delayMs: 950,
    routes: [
      ["free", "/api/health", 3],
      ["free", "/api/user?id=u-2", 1],
      ["pro", "/api/user?id=u-11", 2],
      ["pro", "/api/search?q=baseline&slow=85", 1],
      ["enterprise", "/api/health", 2],
      ["enterprise", "/api/search?q=steady&slow=95", 1]
    ]
  },
  calm: {
    parallel: 1,
    delayMs: 1450,
    routes: [
      ["free", "/api/health", 4],
      ["free", "/api/search?slow=40", 1],
      ["pro", "/api/user?id=u-7", 2],
      ["enterprise", "/api/health", 2],
      ["enterprise", "/api/user?id=u-3", 1]
    ]
  },
  balanced: {
    parallel: 3,
    delayMs: 900,
    routes: [
      ["free", "/api/health", 3],
      ["free", "/api/search?q=docs&slow=80", 1],
      ["pro", "/api/user?id=u-11", 2],
      ["pro", "/api/search?q=policy&slow=110", 2],
      ["enterprise", "/api/search?q=exports&slow=120", 2],
      ["enterprise", "/api/export?slow=180", 1]
    ]
  },
  surge: {
    parallel: 4,
    delayMs: 650,
    routes: [
      ["free", "/api/health", 2],
      ["free", "/api/search?q=burst&slow=130", 2],
      ["pro", "/api/search?q=traffic&slow=170", 3],
      ["pro", "/api/export?slow=220", 1],
      ["enterprise", "/api/search?q=tenant&slow=180", 3],
      ["enterprise", "/api/export?slow=260", 2]
    ]
  },
  anomaly: {
    parallel: 2,
    delayMs: 780,
    routes: [
      ["free", "/api/health", 2],
      ["free", "/api/search?q=odd-a&slow=120", 1],
      ["free", "/api/user?id=u-31", 1],
      ["pro", "/api/search?q=odd-b&slow=150", 1],
      ["pro", "/api/export?slow=200", 1],
      ["enterprise", "/api/user?id=u-99", 1],
      ["enterprise", "/api/search?q=odd-c&slow=160", 1]
    ]
  },
  abuseProbe: {
    parallel: 4,
    delayMs: 260,
    routes: [
      ["pro", "/api/health", 1],
      ["pro", "/api/user?id=u-77", 1],
      ["pro", "/api/search?q=probe-a&slow=145&errorRate=0.01", 2],
      ["pro", "/api/search?q=probe-b&slow=165&errorRate=0.01", 2],
      ["pro", "/api/export?slow=235&errorRate=0.02", 1]
    ]
  },
  stress: {
    parallel: burstMode ? 4 : 2,
    delayMs: burstMode ? 520 : 980,
    routes: [
      ["free", "/api/search?q=stress&slow=160", 1],
      ["pro", "/api/search?q=reports&slow=200&errorRate=0.01", 2],
      ["pro", "/api/export?slow=230&errorRate=0.02", 1],
      ["enterprise", "/api/search?q=analytics&slow=210&errorRate=0.02", 2],
      ["enterprise", "/api/export?slow=250&errorRate=0.03", 1]
    ]
  },
  cooldown: {
    parallel: 0,
    delayMs: 2600,
    routes: []
  },
  recovery: {
    parallel: 2,
    delayMs: 1700,
    routes: [
      ["free", "/api/health", 4],
      ["free", "/api/user?id=u-5", 1],
      ["pro", "/api/health", 3],
      ["enterprise", "/api/health", 3],
      ["enterprise", "/api/user?id=u-17", 1]
    ]
  }
}

const scriptedSequence = burstMode
  ? ["baseline", "balanced", "surge", "anomaly", "abuseProbe", "stress", "cooldown", "recovery"]
  : ["calm", "baseline", "balanced", "anomaly", "abuseProbe", "surge", "cooldown", "recovery"]

const state = {
  phaseIndex: 0,
  phaseName: scriptedSequence[0],
  requestsInPhase: 0,
  recent: [],
  cooldownRounds: 0,
  lastAnnouncedPhase: "",
  redisBlipDone: false
}

function weightedPick(entries) {
  const total = entries.reduce((sum, [, , weight]) => sum + weight, 0)
  let cursor = Math.random() * total
  for (const entry of entries) {
    cursor -= entry[2]
    if (cursor <= 0) {
      return entry
    }
  }
  return entries[entries.length - 1]
}

function remember(result) {
  state.recent.push(result)
  if (state.recent.length > 80) {
    state.recent.shift()
  }
}

function recentBlockedRatio() {
  if (state.recent.length === 0) {
    return 0
  }
  const blocked = state.recent.filter((item) => item.decision !== "ALLOW").length
  return blocked / state.recent.length
}

function recentAllowedRatio() {
  if (state.recent.length === 0) {
    return 1
  }
  const allowed = state.recent.filter((item) => item.decision === "ALLOW").length
  return allowed / state.recent.length
}

function currentPlan() {
  return phasePlans[state.phaseName]
}

function announcePhase(force = false) {
  const plan = currentPlan()
  if (!force && state.lastAnnouncedPhase === state.phaseName) {
    return
  }

  state.lastAnnouncedPhase = state.phaseName
  const blockedRatio = (recentBlockedRatio() * 100).toFixed(1)
  const allowedRatio = (recentAllowedRatio() * 100).toFixed(1)
  process.stdout.write(
    `\n=== phase=${state.phaseName} parallel=${plan.parallel} delayMs=${plan.delayMs} allowed=${allowedRatio}% blocked=${blockedRatio}% ===\n`
  )
}

function maybeTriggerRedisBlip() {
  if (!redisBlipMode || state.redisBlipDone || liveMode) {
    return
  }

  if (state.phaseName !== "cooldown" || state.requestsInPhase > 0) {
    return
  }

  try {
    process.stdout.write("\n*** redis-blip start: stopping redis primary and replicas for 4 seconds ***\n")
    execSync("docker-compose stop redis-primary redis-replica-1 redis-replica-2", {
      stdio: "inherit",
      cwd: process.cwd(),
      shell: true
    })
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4000)
    execSync("docker-compose start redis-primary redis-replica-1 redis-replica-2", {
      stdio: "inherit",
      cwd: process.cwd(),
      shell: true
    })
    process.stdout.write("*** redis-blip end: redis services restarted ***\n\n")
    state.redisBlipDone = true
  } catch (error) {
    process.stderr.write(`*** redis-blip skipped: ${error.message} ***\n`)
    state.redisBlipDone = true
  }
}

function rotatePhase() {
  const blockedRatio = recentBlockedRatio()
  const allowedRatio = recentAllowedRatio()
  const controllerLimited = state.recent.filter((item) => item.reason === "CONTROLLER_STRESS_REDUCTION").length
  const controllerRatio = state.recent.length ? controllerLimited / state.recent.length : 0

  if (blockedRatio > 0.68 || controllerRatio > 0.45) {
    state.phaseName = "cooldown"
    state.requestsInPhase = 0
    state.cooldownRounds = Math.max(state.cooldownRounds, 4)
    announcePhase(true)
    return
  }

  if ((state.phaseName === "cooldown" || state.phaseName === "recovery") && state.cooldownRounds > 0) {
    state.cooldownRounds -= 1
    return
  }

  if (state.phaseName === "cooldown") {
    state.phaseName = "recovery"
    state.requestsInPhase = 0
    state.cooldownRounds = 2
    announcePhase(true)
    return
  }

  if (state.phaseName === "recovery" && allowedRatio > 0.68 && state.requestsInPhase > 10) {
    state.phaseIndex = (state.phaseIndex + 1) % scriptedSequence.length
    state.phaseName = scriptedSequence[state.phaseIndex]
    state.requestsInPhase = 0
    announcePhase(true)
    return
  }

  const phaseBudget =
    state.phaseName === "stress" ? 10 :
    state.phaseName === "abuseProbe" ? 8 :
    state.phaseName === "surge" ? 14 :
    state.phaseName === "anomaly" ? 8 :
    state.phaseName === "baseline" ? 16 :
    12
  if (state.requestsInPhase >= phaseBudget) {
    state.phaseIndex = (state.phaseIndex + 1) % scriptedSequence.length
    state.phaseName = scriptedSequence[state.phaseIndex]
    state.requestsInPhase = 0
    announcePhase(true)
  }
}

function buildRequest() {
  const plan = currentPlan()
  if (plan.routes.length === 0) {
    return null
  }
  const [tenantKey, path] = weightedPick(plan.routes)
  return {
    tenantKey,
    apiKey: tenants[tenantKey].apiKey,
    path
  }
}

async function fireOnce(index) {
  const baseUrl = gateways[index % gateways.length]
  const request = buildRequest()
  if (!request) {
    return
  }
  try {
    const response = await fetch(`${baseUrl}${request.path}`, {
      headers: {
        "x-api-key": request.apiKey
      }
    })
    const reason = response.headers.get("x-sentinel-reason") ?? "UNKNOWN"
    const decision = response.headers.get("x-sentinel-decision") ?? "UNKNOWN"
    const result = {
      decision,
      reason
    }
    remember(result)
    process.stdout.write(
      `[${state.phaseName.padEnd(8)}] ${decision.padEnd(5)} ${reason.padEnd(32)} ${baseUrl}${request.path}\n`
    )
  } catch (error) {
    remember({ decision: "ERROR", reason: error.message })
    process.stderr.write(`[${state.phaseName.padEnd(8)}] ERROR ${baseUrl}${request.path} ${error.message}\n`)
  }
}

async function runRound(round) {
  const plan = currentPlan()
  announcePhase()
  if (plan.parallel > 0) {
    await Promise.all(Array.from({ length: plan.parallel }, (_, index) => fireOnce(round * plan.parallel + index)))
    state.requestsInPhase += plan.parallel
  }
  rotatePhase()
  maybeTriggerRedisBlip()
  const nextPlan = currentPlan()
  const blockedRatio = recentBlockedRatio()
  const adaptiveDelay = state.phaseName === "recovery" || state.phaseName === "cooldown"
    ? nextPlan.delayMs + 450
    : nextPlan.delayMs
  const extraDelay = blockedRatio > 0.8 ? 350 : 0
  await new Promise((resolve) => setTimeout(resolve, adaptiveDelay + extraDelay))
}

async function main() {
  const rounds = burstMode ? 120 : 54
  announcePhase(true)

  if (liveMode) {
    let round = 0
    while (true) {
      await runRound(round)
      round += 1
    }
  }

  for (let round = 0; round < rounds; round += 1) {
    await runRound(round)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
