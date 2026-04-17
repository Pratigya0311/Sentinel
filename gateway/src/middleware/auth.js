export function resolveTenant(request, tenantsByApiKey) {
  const apiKey = request.headers["x-api-key"]
  if (!apiKey) {
    return null
  }

  return tenantsByApiKey.get(apiKey) ?? null
}

