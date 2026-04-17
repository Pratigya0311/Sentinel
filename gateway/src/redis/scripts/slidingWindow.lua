local now = tonumber(ARGV[1])
local tenant_capacity = tonumber(ARGV[2])
local global_capacity = tonumber(ARGV[3])
local request_cost = tonumber(ARGV[4])
local window_ms = tonumber(ARGV[5])
local tenant_budget = tonumber(ARGV[6])
local tenant_max_share = tonumber(ARGV[7])
local member = ARGV[8]
local min_share_floor = tonumber(ARGV[9])

local function collect_cost(key)
  redis.call("ZREMRANGEBYSCORE", key, 0, now - window_ms)
  local members = redis.call("ZRANGE", key, 0, -1)
  local total = 0
  for _, item in ipairs(members) do
    local cost = tonumber(string.match(item, ":(%d+)$") or "0")
    total = total + cost
  end
  return total
end

local tenant_usage = collect_cost(KEYS[1])
local global_usage = collect_cost(KEYS[2])
local tenant_spend = tonumber(redis.call("GET", KEYS[3]) or "0")
local total_spend = tonumber(redis.call("GET", KEYS[4]) or "0")

if tenant_spend + request_cost > tenant_budget then
  return {0, math.max(0, tenant_capacity - tenant_usage), 0, 3}
end

local projected_total = total_spend + request_cost
if tenant_max_share > 0 and projected_total >= min_share_floor then
  local projected_share = (tenant_spend + request_cost) / projected_total
  if projected_share > tenant_max_share then
    return {0, math.max(0, tenant_capacity - tenant_usage), 0, 4}
  end
end

if tenant_usage + request_cost > tenant_capacity then
  return {0, math.max(0, tenant_capacity - tenant_usage), window_ms, 1}
end

if global_usage + request_cost > global_capacity then
  return {0, math.max(0, global_capacity - global_usage), window_ms, 2}
end

redis.call("ZADD", KEYS[1], now, member .. ":" .. request_cost)
redis.call("ZADD", KEYS[2], now, member .. ":" .. request_cost)
redis.call("PEXPIRE", KEYS[1], window_ms)
redis.call("PEXPIRE", KEYS[2], window_ms)
redis.call("INCRBY", KEYS[3], request_cost)
redis.call("INCRBY", KEYS[4], request_cost)
redis.call("PEXPIRE", KEYS[3], window_ms)
redis.call("PEXPIRE", KEYS[4], window_ms)

return {1, math.max(0, tenant_capacity - tenant_usage - request_cost), 0, 0}
