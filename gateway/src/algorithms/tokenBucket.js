const buckets = new Map();

function now() {
    return Date.now() / 1000;
}

function checkTokenBucket(key, capacity, refillRate, cost = 1) {

    let bucket = buckets.get(key);

    if (!bucket) {
        bucket = {
            tokens: capacity,
            lastRefill: now()
        };
    }

    const currentTime = now();
    const elapsed = currentTime - bucket.lastRefill;

    bucket.tokens = Math.min(
        capacity,
        bucket.tokens + elapsed * refillRate
    );

    bucket.lastRefill = currentTime;

    let allow = false;

    if (bucket.tokens >= cost) {
        bucket.tokens -= cost;
        allow = true;
    }

    buckets.set(key, bucket);

    const remaining = Math.floor(bucket.tokens);

    return {
        allow,
        remaining,
        retry_after_seconds: allow
            ? 0
            : Math.ceil((cost - bucket.tokens) / refillRate)
    };
}

module.exports = {
    checkTokenBucket
};