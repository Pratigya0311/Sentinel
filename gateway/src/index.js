const fastify = require("fastify")({ logger: true });
const proxy = require("@fastify/http-proxy");
const { randomUUID } = require("crypto");

const metrics = require("./middleware/metrics");
const config = require("./config");
const authMiddleware = require("./middleware/auth");
const policyMiddleware = require("./middleware/policy");
const { checkTokenBucket } = require("./algorithms/tokenBucket");

/* -----------------------------------
   TRACE ID
------------------------------------ */
fastify.addHook("onRequest", async (request, reply) => {
    request.traceId = randomUUID();
    reply.header("X-Trace-Id", request.traceId);
});

/* -----------------------------------
   RESPONSE LOGGING + METRICS
------------------------------------ */
fastify.addHook("onResponse", async (request, reply) => {

    metrics.recordRequest(
        request.rateLimitDecision,
        reply.statusCode
    );

    console.log({
        traceId: request.traceId,
        method: request.method,
        url: request.url,
        status: reply.statusCode,
        apiKey: request.apiKey || null
    });
});

/* -----------------------------------
   HEALTH ROUTE
------------------------------------ */
fastify.get("/health", async () => {
    return { status: "Gateway is running" };
});

/* -----------------------------------
   PROTECTED API ROUTES
------------------------------------ */
fastify.register(async function (instance) {

    // 1️⃣ AUTH
    instance.addHook("preHandler", authMiddleware);

    // 2️⃣ POLICY
    instance.addHook("preHandler", policyMiddleware);

    // 3️⃣ REAL TOKEN BUCKET RATE LIMIT
    instance.addHook("preHandler", async (request, reply) => {

        console.log("DEBUG POLICY:", request.policy);
        console.log("DEBUG BUDGET:", request.budget);
        
        const key = request.apiKey + ":" + request.url;

        const capacity = request.budget;
        const refillRate = request.budget / 60; // full refill in 60s
        const cost = request.policy.base_cost;

        const result = checkTokenBucket(
            key,
            capacity,
            refillRate,
            cost
        );

        const decision = {
            allow: result.allow,
            reason: result.allow
                ? "token_bucket_ok"
                : "token_bucket_empty",
            retry_after_seconds: result.retry_after_seconds,
            budget: capacity,
            used: capacity - result.remaining,
            remaining: result.remaining,
            cost: cost,
            algorithm: "token_bucket"
        };

        request.rateLimitDecision = decision;

        if (!decision.allow) {
            return reply.code(429).send(decision);
        }

        reply.header("X-Sentinel-Decision", decision.allow ? "allow" : "deny");
        reply.header("X-Sentinel-Reason", decision.reason);
        reply.header("X-Sentinel-Remaining", decision.remaining);
        reply.header("X-Sentinel-Algorithm", decision.algorithm);
    });

    // 4️⃣ REVERSE PROXY
    instance.register(proxy, {
        upstream: config.BACKEND_URL,
        prefix: "/api",
    });

});

/* -----------------------------------
   START SERVER
------------------------------------ */
const start = async () => {
    try {
        await fastify.listen({
            port: config.PORT,
            host: "0.0.0.0"
        });
        console.log(`Gateway running on port ${config.PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

metrics.startMetricsEmitter("gw-1");

start();