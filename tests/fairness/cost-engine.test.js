import test from "node:test"
import assert from "node:assert/strict"
import { calculateRequestCost } from "../../gateway/src/services/costEngine.js"
import { evaluateTenantFairness } from "../../gateway/src/services/tenantEngine.js"

test("cost engine increases effective cost for stressed routes", () => {
  const costs = {
    "/api/export": { baseCost: 25 }
  }

  const result = calculateRequestCost("/api/export", costs, 920)
  assert.equal(result.baseCost, 25)
  assert.equal(result.dynamicMultiplier, 1.7)
  assert.equal(result.effectiveCost, 43)
})

test("tenant fairness denies when max share is exceeded", () => {
  const fairness = evaluateTenantFairness({
    tenant: { creditBudget: 100, maxShare: 0.25 },
    requestCost: 20,
    currentSpend: 40,
    totalSpend: 60
  })

  assert.equal(fairness.allowed, false)
  assert.equal(fairness.reason, "TENANT_MAX_SHARE_EXCEEDED")
})

