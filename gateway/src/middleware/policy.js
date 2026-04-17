export function resolvePolicy(routePath, policiesByRoute) {
  return policiesByRoute.get(routePath) ?? null
}

