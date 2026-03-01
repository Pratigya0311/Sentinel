const validKeys = {
    "test123": { tier: "free", budget: 1000 },
    "pro456": { tier: "pro", budget: 5000 }
};

const authMiddleware = async (request, reply) => {
    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
        return reply.code(401).send({ error: "API key missing" });
    }

    const keyData = validKeys[apiKey];

    if (!keyData) {
        return reply.code(401).send({ error: "Invalid API key" });
    }

    request.apiKey = apiKey;
    request.tier = keyData.tier;
    request.budget = keyData.budget;
};

module.exports = authMiddleware;