local now = tonumber(ARGV[1])
local tenant_capacity = tonumber(ARGV[2])
local global_capacity = tonumber(ARGV[3])
local request_cost = tonumber(ARGV[4])
local window_ms = tonumber(ARGV[5])
local tenant_budget = tonumber(ARGV[6])
local tenant_max_share = tonumber(ARGV[7])
local min_share_floor = tonumber(ARGV[8])

local tenant_usage = tonumber(redis.call("GET", KEYS[1]) or "0")
local global_usage = tonumber(redis.call("GET", KEYS[2]) or "0")
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
  local ttl = redis.call("PTTL", KEYS[1])
  return {0, math.max(0, tenant_capacity - tenant_usage), ttl, 1}
end

if global_usage + request_cost > global_capacity then
  local ttl = redis.call("PTTL", KEYS[2])
  return {0, math.max(0, global_capacity - global_usage), ttl, 2}
end

redis.call("INCRBY", KEYS[1], request_cost)
redis.call("INCRBY", KEYS[2], request_cost)
redis.call("INCRBY", KEYS[3], request_cost)
redis.call("INCRBY", KEYS[4], request_cost)
if redis.call("PTTL", KEYS[1]) < 0 then redis.call("PEXPIRE", KEYS[1], window_ms) end
if redis.call("PTTL", KEYS[2]) < 0 then redis.call("PEXPIRE", KEYS[2], window_ms) end
if redis.call("PTTL", KEYS[3]) < 0 then redis.call("PEXPIRE", KEYS[3], window_ms) end
if redis.call("PTTL", KEYS[4]) < 0 then redis.call("PEXPIRE", KEYS[4], window_ms) end

return {1, math.max(0, tenant_capacity - tenant_usage - request_cost), 0, 0}
