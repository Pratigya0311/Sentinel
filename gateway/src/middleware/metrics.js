let counters = {
    total: 0,
    allowed: 0,
    blocked: 0,
    errors: 0
};

function recordRequest(decision, statusCode) {
    counters.total++;

    if (decision && decision.allow) {
        counters.allowed++;
    } else {
        counters.blocked++;
    }

    if (statusCode >= 500) {
        counters.errors++;
    }
}

function startMetricsEmitter(gatewayId = "gw-1") {
    setInterval(() => {

        const tick = {
            ts: Math.floor(Date.now() / 1000),
            gateway_id: gatewayId,
            rps: counters.total,
            allowed: counters.allowed,
            blocked: counters.blocked,
            errors: counters.errors
        };

        console.log("METRICS_TICK", JSON.stringify(tick));

        counters = {
            total: 0,
            allowed: 0,
            blocked: 0,
            errors: 0
        };

    }, 1000);
}

module.exports = {
    recordRequest,
    startMetricsEmitter
};