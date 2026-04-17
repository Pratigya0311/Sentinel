local now = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local tenant_capacity = tonumber(ARGV[3])
local global_capacity = tonumber(ARGV[4])
local request_cost = tonumber(ARGV[5])
local window_ms = tonumber(ARGV[6])
local tenant_budget = tonumber(ARGV[7])
local tenant_max_share = tonumber(ARGV[8])
local min_share_floor = tonumber(ARGV[9])

local function read_bucket(key, capacity)
  local values = redis.call("HMGET", key, "tokens", "ts")
  local tokens = tonumber(values[1])
  local ts = tonumber(values[2])
  if not tokens then
    return capacity, now
  end

  local elapsed = math.max(0, now - ts) / 1000
  local replenished = math.min(capacity, tokens + (elapsed * refill_rate))
  return replenished, ts
end

local tenant_tokens, tenant_ts = read_bucket(KEYS[1], tenant_capacity)
local global_tokens, global_ts = read_bucket(KEYS[2], global_capacity)
local tenant_spend = tonumber(redis.call("GET", KEYS[3]) or "0")
local total_spend = tonumber(redis.call("GET", KEYS[4]) or "0")

if tenant_spend + request_cost > tenant_budget then
  return {0, math.floor(tenant_tokens), 0, 3}
end

local projected_total = total_spend + request_cost
if tenant_max_share > 0 and projected_total >= min_share_floor then
  local projected_share = (tenant_spend + request_cost) / projected_total
  if projected_share > tenant_max_share then
    return {0, math.floor(tenant_tokens), 0, 4}
  end
end

if tenant_tokens < request_cost then
  local retry_ms = math.ceil(((request_cost - tenant_tokens) / refill_rate) * 1000)
  return {0, math.floor(tenant_tokens), retry_ms, 1}
end

if global_tokens < request_cost then
  local retry_ms = math.ceil(((request_cost - global_tokens) / refill_rate) * 1000)
  return {0, math.floor(global_tokens), retry_ms, 2}
end

tenant_tokens = tenant_tokens - request_cost
global_tokens = global_tokens - request_cost
redis.call("HMSET", KEYS[1], "tokens", tenant_tokens, "ts", now)
redis.call("HMSET", KEYS[2], "tokens", global_tokens, "ts", now)
redis.call("PEXPIRE", KEYS[1], window_ms)
redis.call("PEXPIRE", KEYS[2], window_ms)
redis.call("INCRBY", KEYS[3], request_cost)
redis.call("INCRBY", KEYS[4], request_cost)
redis.call("PEXPIRE", KEYS[3], window_ms)
redis.call("PEXPIRE", KEYS[4], window_ms)

return {1, math.floor(tenant_tokens), 0, 0}
