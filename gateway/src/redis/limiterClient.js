import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createTraceId } from "../utils/trace.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptsDir = path.resolve(__dirname, "./scripts")

const scriptNames = {
  "token-bucket": "tokenBucket.lua",
  "fixed-window": "fixedWindow.lua",
  "sliding-window": "slidingWindow.lua"
}

const reasonMap = {
  0: "ALLOWED",
  1: "RATE_LIMIT_EXCEEDED",
  2: "GLOBAL_CAPACITY_PROTECTED",
  3: "TENANT_BUDGET_EXHAUSTED",
  4: "TENANT_MAX_SHARE_EXCEEDED"
}

export class LimiterClient {
  constructor(redis) {
    this.redis = redis
    this.scripts = new Map()
    for (const [algorithm, fileName] of Object.entries(scriptNames)) {
      const source = fs.readFileSync(path.join(scriptsDir, fileName), "utf8")
      this.scripts.set(algorithm, { sha: null, source })
    }
  }

  async loadScripts() {
    for (const [algorithm, script] of this.scripts.entries()) {
      const sha = await this.redis.script("LOAD", script.source)
      this.scripts.set(algorithm, { ...script, sha })
    }
  }

  keysFor({ tenantId, route }) {
    return {
      tenantKey: `sentinel:${route}:${tenantId}:limit`,
      globalKey: `sentinel:${route}:global:limit`,
      tenantSpendKey: `sentinel:${route}:${tenantId}:spend`,
      totalSpendKey: `sentinel:${route}:global:spend`
    }
  }

  async evaluate({ policy, tenant, route, requestCost }) {
    const { tenantKey, globalKey, tenantSpendKey, totalSpendKey } = this.keysFor({
      tenantId: tenant.tenantId,
      route
    })

    const script = this.scripts.get(policy.algorithm)
    const now = Date.now()
    const commonArgs = [
      now,
      policy.capacity + (tenant.burst ?? 0),
      policy.globalCapacity,
      requestCost,
      policy.windowMs,
      tenant.creditBudget,
      tenant.maxShare ?? 0,
      Math.max(50, requestCost * 5)
    ]

    let keys = [tenantKey, globalKey, tenantSpendKey, totalSpendKey]
    let args = commonArgs

    if (policy.algorithm === "token-bucket") {
      args = [
        now,
        policy.refillRate ?? 10,
        policy.capacity + (tenant.burst ?? 0),
        policy.globalCapacity,
        requestCost,
        policy.windowMs,
        tenant.creditBudget,
        tenant.maxShare ?? 0,
        Math.max(50, requestCost * 5)
      ]
    }

    if (policy.algorithm === "sliding-window") {
      args = [...commonArgs.slice(0, 7), createTraceId(), commonArgs[7]]
    }

    let result
    try {
      if (!script.sha) {
        throw new Error("NOSCRIPT")
      }
      result = await this.redis.evalsha(script.sha, keys.length, ...keys, ...args)
    } catch (error) {
      if (String(error.message).includes("NOSCRIPT")) {
        result = await this.redis.eval(script.source, keys.length, ...keys, ...args)
      } else {
        throw error
      }
    }

    const [allowed, remaining, retryAfterMs, reasonCode] = result.map(Number)
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterMs,
      reason: reasonMap[reasonCode] ?? "RATE_LIMIT_EXCEEDED"
    }
  }
}
