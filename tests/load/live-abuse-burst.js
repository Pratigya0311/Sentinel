const gateways = (process.env.GATEWAYS ?? "http://127.0.0.1:3000,http://127.0.0.1:3001")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

const proKey = "sentinel-pro-key"
const enterpriseKey = "sentinel-enterprise-key"

const routes = [
  { apiKey: proKey, path: "/api/health", weight: 1 },
  { apiKey: proKey, path: "/api/user?id=u-77", weight: 1 },
  { apiKey: proKey, path: "/api/search?q=abuse-a&slow=150&errorRate=0.01", weight: 3 },
  { apiKey: proKey, path: "/api/search?q=abuse-b&slow=170&errorRate=0.01", weight: 3 },
  { apiKey: proKey, path: "/api/export?slow=245&errorRate=0.02", weight: 2 },
  { apiKey: enterpriseKey, path: "/api/search?q=burst-tenant&slow=180&errorRate=0.01", weight: 1 }
]

function weightedPick(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = Math.random() * total
  for (const entry of entries) {
    cursor -= entry.weight
    if (cursor <= 0) {
      return entry
    }
  }
  return entries[entries.length - 1]
}

async function fireOnce(index) {
  const baseUrl = gateways[index % gateways.length]
  const request = weightedPick(routes)
  try {
    const response = await fetch(`${baseUrl}${request.path}`, {
      headers: {
        "x-api-key": request.apiKey
      }
    })
    const reason = response.headers.get("x-sentinel-reason") ?? "UNKNOWN"
    const decision = response.headers.get("x-sentinel-decision") ?? "UNKNOWN"
    process.stdout.write(`[abuse   ] ${decision.padEnd(5)} ${reason.padEnd(32)} ${baseUrl}${request.path}\n`)
  } catch (error) {
    process.stderr.write(`[abuse   ] ERROR ${baseUrl}${request.path} ${error.message}\n`)
  }
}

async function main() {
  process.stdout.write("\n=== abuse burst mode: high fan-out, same-tenant pressure, intentional stress ===\n")
  for (let round = 0; round < 180; round += 1) {
    await Promise.all(Array.from({ length: 8 }, (_, index) => fireOnce(round * 8 + index)))
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
