export function evaluateTenantFairness({ tenant, requestCost, currentSpend, totalSpend }) {
  const nextTenantSpend = currentSpend + requestCost
  const nextTotalSpend = totalSpend + requestCost

  if (nextTenantSpend > tenant.creditBudget) {
    return {
      allowed: false,
      reason: "TENANT_BUDGET_EXHAUSTED"
    }
  }

  if (tenant.maxShare && nextTotalSpend > 0) {
    const nextShare = nextTenantSpend / nextTotalSpend
    if (nextShare > tenant.maxShare) {
      return {
        allowed: false,
        reason: "TENANT_MAX_SHARE_EXCEEDED"
      }
    }
  }

  return {
    allowed: true,
    reason: "ALLOWED"
  }
}

