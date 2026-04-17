function dynamicMultiplier(latencyMs) {
  if (latencyMs > 900) {
    return 1.7
  }
  if (latencyMs > 500) {
    return 1.35
  }
  if (latencyMs > 250) {
    return 1.15
  }
  return 1
}

function latencyBand(latencyMs) {
  if (latencyMs > 900) {
    return "critical"
  }
  if (latencyMs > 500) {
    return "high"
  }
  if (latencyMs > 250) {
    return "elevated"
  }
  return "normal"
}

export function calculateRequestCost(route, costsByRoute, latencyMs = 0) {
  const base = costsByRoute[route]?.baseCost ?? 1
  const multiplier = dynamicMultiplier(latencyMs)
  return {
    baseCost: base,
    dynamicMultiplier: multiplier,
    latencyBand: latencyBand(latencyMs),
    effectiveCost: Math.ceil(base * multiplier)
  }
}
