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
  idle: {
    parallel: 1,
    delayMs: 1400,
    rounds: 4,
    routes: [
      ["free", "/api/health", 5],
      ["free", "/api/user?id=idle-free", 1],
      ["pro", "/api/health", 4],
      ["enterprise", "/api/health", 4],
      ["enterprise", "/api/user?id=idle-ent", 1]
    ]
  },
  baseline: {
    parallel: 3,
    delayMs: 820,
    rounds: 8,
    routes: [
      ["free", "/api/health", 4],
      ["free", "/api/user?id=base-free", 1],
      ["pro", "/api/user?id=base-pro", 2],
      ["pro", "/api/search?q=baseline&slow=90", 2],
      ["enterprise", "/api/health", 3],
      ["enterprise", "/api/search?q=steady&slow=100", 2]
    ]
  },
  fairnessWave: {
    parallel: 5,
    delayMs: 520,
    rounds: 8,
    routes: [
      ["free", "/api/health", 1],
      ["pro", "/api/health", 1],
      ["pro", "/api/search?q=fairness-a&slow=110", 2],
      ["pro", "/api/search?q=fairness-b&slow=130", 2],
      ["pro", "/api/export?slow=210", 2],
      ["enterprise", "/api/search?q=buffer&slow=120", 1],
      ["enterprise", "/api/health", 1]
    ]
  },
  costWave: {
    parallel: 5,
    delayMs: 460,
    rounds: 8,
    routes: [
      ["free", "/api/health", 1],
      ["pro", "/api/search?q=cost-a&slow=160", 2],
      ["pro", "/api/export?slow=245", 2],
      ["enterprise", "/api/search?q=cost-b&slow=180", 2],
      ["enterprise", "/api/export?slow=285", 3]
    ]
  },
  controllerWave: {
    parallel: 6,
    delayMs: 360,
    rounds: 8,
    routes: [
      ["free", "/api/search?q=ctrl-free&slow=170", 1],
      ["pro", "/api/search?q=ctrl-pro-a&slow=210&errorRate=0.02", 3],
      ["pro", "/api/export?slow=280&errorRate=0.03", 2],
      ["enterprise", "/api/search?q=ctrl-ent&slow=240&errorRate=0.02", 3],
      ["enterprise", "/api/export?slow=320&errorRate=0.03", 2]
    ]
  },
  abuseLite: {
    parallel: 8,
    delayMs: 180,
    rounds: 7,
    routes: [
      ["pro", "/api/health", 1],
      ["pro", "/api/user?id=abuse-lite", 1],
      ["pro", "/api/search?q=abuse-lite-a&slow=160&errorRate=0.01", 4],
      ["pro", "/api/search?q=abuse-lite-b&slow=185&errorRate=0.01", 4],
      ["pro", "/api/export?slow=245&errorRate=0.02", 3],
      ["pro", "/api/export?slow=260&errorRate=0.02", 2],
      ["enterprise", "/api/search?q=abuse-cover&slow=165", 1]
    ]
  },
  cooldown: {
    parallel: 2,
    delayMs: 1650,
    rounds: 5,
    routes: [
      ["free", "/api/health", 5],
      ["pro", "/api/health", 4],
      ["enterprise", "/api/health", 4],
      ["enterprise", "/api/user?id=cool-ent", 1]
    ]
  },
  recovery: {
    parallel: 3,
    delayMs: 1180,
    rounds: 6,
    routes: [
      ["free", "/api/health", 4],
      ["free", "/api/user?id=recover-free", 1],
      ["pro", "/api/health", 3],
      ["pro", "/api/user?id=recover-pro", 1],
      ["enterprise", "/api/health", 3],
      ["enterprise", "/api/search?q=recover&slow=90", 1]
    ]
  }
}

const scriptedSequence = [
  "idle",
  "baseline",
  "fairnessWave",
  "baseline",
  "costWave",
  "cooldown",
  "recovery",
  "baseline",
  "controllerWave",
  "cooldown",
  "recovery",
  "baseline",
  "abuseLite",
  "cooldown",
  "recovery"
]

const state = {
  phaseIndex: 0,
  phaseName: scriptedSequence[0],
  roundsInPhase: 0,
  recent: [],
  lastAnnouncedPhase: ""
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
  if (state.recent.length > 120) {
    state.recent.shift()
  }
}

function recentRatio(predicate, fallback = 0) {
  if (state.recent.length === 0) {
    return fallback
  }
  return state.recent.filter(predicate).length / state.recent.length
}

function recentReasonCount(reason) {
  return state.recent.filter((item) => item.reason === reason).length
}

function currentPlan() {
  return phasePlans[state.phaseName]
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`
}

function announcePhase(force = false) {
  const plan = currentPlan()
  if (!force && state.lastAnnouncedPhase === state.phaseName) {
    return
  }

  state.lastAnnouncedPhase = state.phaseName
  const blockedRatio = recentRatio((item) => item.decision !== "ALLOW")
  const abuseRatio = recentRatio((item) => item.reason === "ABUSE_SIGNAL_HIGH")
  const controllerRatio = recentRatio((item) => item.reason === "CONTROLLER_STRESS_REDUCTION")
  process.stdout.write(
    `\n=== live phase=${state.phaseName} parallel=${plan.parallel} delayMs=${plan.delayMs} blocked=${formatPercent(blockedRatio)} abuse=${formatPercent(abuseRatio)} controller=${formatPercent(controllerRatio)} ===\n`
  )
}

function advancePhase() {
  state.phaseIndex = (state.phaseIndex + 1) % scriptedSequence.length
  state.phaseName = scriptedSequence[state.phaseIndex]
  state.roundsInPhase = 0
  announcePhase(true)
}

function rotatePhase() {
  const plan = currentPlan()
  const blockedRatio = recentRatio((item) => item.decision !== "ALLOW")
  const abuseCount = recentReasonCount("ABUSE_SIGNAL_HIGH")

  if (state.phaseName === "abuseLite" && (abuseCount >= 3 || blockedRatio >= 0.52)) {
    state.phaseName = "cooldown"
    state.roundsInPhase = 0
    announcePhase(true)
    return
  }

  if (state.phaseName === "controllerWave" && blockedRatio >= 0.45) {
    state.phaseName = "cooldown"
    state.roundsInPhase = 0
    announcePhase(true)
    return
  }

  if ((state.phaseName === "fairnessWave" || state.phaseName === "costWave") && blockedRatio >= 0.38) {
    state.phaseName = "cooldown"
    state.roundsInPhase = 0
    announcePhase(true)
    return
  }

  if (state.roundsInPhase >= plan.rounds) {
    advancePhase()
  }
}

function buildRequest() {
  const plan = currentPlan()
  if (plan.routes.length === 0) {
    return null
  }

  const [tenantKey, path] = weightedPick(plan.routes)
  return {
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
    remember({ decision, reason })
    process.stdout.write(`[live    ] ${decision.padEnd(5)} ${reason.padEnd(32)} ${baseUrl}${request.path}\n`)
  } catch (error) {
    remember({ decision: "ERROR", reason: error.message })
    process.stderr.write(`[live    ] ERROR ${baseUrl}${request.path} ${error.message}\n`)
  }
}

async function runRound(round) {
  const plan = currentPlan()
  announcePhase()
  await Promise.all(Array.from({ length: plan.parallel }, (_, index) => fireOnce(round * plan.parallel + index)))
  state.roundsInPhase += 1
  rotatePhase()

  const blockedRatio = recentRatio((item) => item.decision !== "ALLOW")
  const adaptiveDelay =
    state.phaseName === "cooldown" || state.phaseName === "recovery"
      ? currentPlan().delayMs + 180
      : currentPlan().delayMs
  const extraDelay = blockedRatio > 0.55 ? 120 : 0

  await new Promise((resolve) => setTimeout(resolve, adaptiveDelay + extraDelay))
}

async function main() {
  announcePhase(true)
  let round = 0
  while (true) {
    await runRound(round)
    round += 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
