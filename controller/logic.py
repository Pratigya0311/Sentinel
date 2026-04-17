from dataclasses import dataclass


@dataclass
class ControllerState:
    multiplier: float = 1.0
    health: str = "healthy"
    reason: str = "BASELINE"


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def classify_health(multiplier: float) -> str:
    if multiplier <= 0.7:
        return "critical"
    if multiplier <= 0.9:
        return "stressed"
    if multiplier >= 1.15:
        return "elastic"
    return "healthy"


def compute_target(payload: dict) -> tuple[float, str]:
    latency_p95 = float(payload.get("p95LatencyMs", 0))
    error_rate = float(payload.get("errorRate", 0))
    blocked_ratio = float(payload.get("blockedRatio", 0))
    throughput = float(payload.get("throughput", 0))

    pressure = 0.0
    reason = "BASELINE"

    if latency_p95 > 900:
        pressure += 0.3
        reason = "LATENCY_CRITICAL"
    elif latency_p95 > 500:
        pressure += 0.15
        reason = "LATENCY_ELEVATED"

    if error_rate > 0.12:
        pressure += 0.25
        reason = "ERROR_RATE_SPIKE"
    elif error_rate > 0.05:
        pressure += 0.1
        reason = "ERROR_RATE_ELEVATED"

    if blocked_ratio > 0.55 and throughput > 20:
        pressure += 0.12
        reason = "BLOCKED_RATIO_HIGH"
    elif blocked_ratio > 0.35 and throughput > 40:
        pressure += 0.06
        reason = "BLOCKED_RATIO_ELEVATED"

    if throughput > 80:
        pressure += 0.1
        reason = "LOAD_HIGH"
    elif throughput < 6 and latency_p95 < 180 and error_rate < 0.01 and blocked_ratio < 0.04:
        recovery = 0.07
        reason = "IDLE_RECOVERY"
        target = 1.0 - pressure + recovery
        return clamp(target, 0.5, 1.25), reason

    recovery = 0.0
    if latency_p95 < 240 and error_rate < 0.02 and blocked_ratio < 0.08 and 8 <= throughput <= 45:
        recovery = 0.04
        reason = "RECOVERY_STABLE"
    elif latency_p95 < 320 and error_rate < 0.03 and blocked_ratio < 0.2:
        reason = "BASELINE"

    target = 1.0 - pressure + recovery
    return clamp(target, 0.5, 1.25), reason


def update_state(state: ControllerState, payload: dict) -> ControllerState:
    target, reason = compute_target(payload)
    next_multiplier = (state.multiplier * 0.7) + (target * 0.3)
    next_multiplier = round(clamp(next_multiplier, 0.5, 1.25), 3)
    return ControllerState(
        multiplier=next_multiplier,
        health=classify_health(next_multiplier),
        reason=reason,
    )
