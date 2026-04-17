import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configDir = path.resolve(__dirname, "../config")

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(configDir, fileName), "utf8"))
}

export function loadConfig() {
  const tenants = readJson("tenants.json")
  const policies = readJson("policies.json")
  const costs = readJson("costs.json")

  return {
    tenantsByApiKey: new Map(tenants.map((tenant) => [tenant.apiKey, tenant])),
    policiesByRoute: new Map(policies.map((policy) => [policy.route, policy])),
    costsByRoute: costs
  }
}

